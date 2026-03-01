'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { CoBuyRequest, CoBuyRequestStatus } from '@/types/types';

const statusLabels: Record<CoBuyRequestStatus, string> = {
  pending: '대기중',
  in_progress: '작업중',
  design_shared: '디자인 공유됨',
  feedback: '피드백 대기',
  confirmed: '확정',
  session_created: '세션 생성됨',
  rejected: '거절',
};

const statusColors: Record<CoBuyRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  design_shared: 'bg-purple-100 text-purple-800',
  feedback: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  session_created: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatDateShort = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
  });
};

export default function CoBuyRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: requests, error } = useSWR<CoBuyRequest[]>(
    `/api/admin/cobuy/requests?status=${statusFilter}`,
    fetcher
  );

  const isLoading = !requests && !error;

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">공동구매 요청 관리</h2>
      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'pending', 'in_progress', 'design_shared', 'feedback', 'confirmed', 'session_created', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? '전체' : statusLabels[status as CoBuyRequestStatus]}
          </button>
        ))}
      </div>

      {/* Request List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 text-sm">요청 목록을 불러올 수 없습니다.</div>
      ) : !requests?.length ? (
        <div className="text-center py-12 text-gray-400 text-sm">요청이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            <div className="w-12 shrink-0" />
            <div className="flex-1 min-w-0 grid grid-cols-[1.2fr_0.8fr_1fr_1.2fr_0.5fr_0.7fr_0.7fr_0.6fr] gap-2">
              <span>단체명</span>
              <span>요청자</span>
              <span>전화번호</span>
              <span>이메일</span>
              <span>수량</span>
              <span>희망 수령일</span>
              <span>요청일</span>
              <span className="text-center">상태</span>
            </div>
          </div>
          {requests.map(req => (
            <Link
              key={req.id}
              href={`/cobuy/requests/${req.id}`}
              className="block w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-100">
                  {req.freeform_preview_url ? (
                    <img src={req.freeform_preview_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-[1.2fr_0.8fr_1fr_1.2fr_0.5fr_0.7fr_0.7fr_0.6fr] gap-2 items-center">
                  <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                  <p className="text-xs text-gray-600 truncate">{req.guest_name || (req as any).profiles?.name || '-'}</p>
                  <p className="text-xs text-gray-500 truncate">{req.guest_phone || (req as any).profiles?.phone || '-'}</p>
                  <p className="text-xs text-gray-500 truncate">{req.guest_email || (req as any).profiles?.email || '-'}</p>
                  <p className="text-xs text-gray-600">{(req.quantity_expectations as any)?.estimatedQuantity ? `${(req.quantity_expectations as any).estimatedQuantity}벌` : '-'}</p>
                  <p className="text-[10px] text-gray-400">{formatDateShort((req.schedule_preferences as any)?.receiveByDate)}</p>
                  <p className="text-[10px] text-gray-400">{formatDate(req.created_at)}</p>
                  <div className="text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[req.status]}`}>
                      {statusLabels[req.status]}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
