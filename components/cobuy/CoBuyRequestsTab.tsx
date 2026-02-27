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
          {requests.map(req => (
            <Link
              key={req.id}
              href={`/cobuy/requests/${req.id}`}
              className="block w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {req.freeform_preview_url && (
                    <div className="w-12 h-12 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-100">
                      <img src={req.freeform_preview_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {(req as any).product?.title} · {(req as any).guest_name ? `${(req as any).guest_name} (비회원)` : ((req as any).profiles?.email || (req as any).profiles?.name || 'Unknown')}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(req.created_at)}</p>
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[req.status]}`}>
                  {statusLabels[req.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
