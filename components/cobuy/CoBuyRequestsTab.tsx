'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Mail, Check } from 'lucide-react';
import { CoBuyRequest, CoBuyRequestStatus } from '@/types/types';

const statusLabels: Record<CoBuyRequestStatus, string> = {
  draft: '작성중',
  pending: '대기중',
  in_progress: '작업중',
  design_shared: '디자인 공유됨',
  feedback: '피드백 대기',
  confirmed: '확정',
  session_created: '세션 생성됨',
  rejected: '거절',
};

const statusColors: Record<CoBuyRequestStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
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
  const [sendingPricing, setSendingPricing] = useState<string | null>(null);
  const [sentPricing, setSentPricing] = useState<Set<string>>(new Set());

  const { data: requests, error } = useSWR<CoBuyRequest[]>(
    `/api/admin/cobuy/requests?status=${statusFilter}`,
    fetcher
  );

  const isLoading = !requests && !error;

  const handleSendPricing = async (e: React.MouseEvent, requestId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSendingPricing(requestId);
    try {
      const res = await fetch('/api/admin/cobuy/requests/send-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      setSentPricing(prev => new Set(prev).add(requestId));
    } catch (err: any) {
      alert(`리마인드 발송 실패: ${err.message}`);
    } finally {
      setSendingPricing(null);
    }
  };

  const hasAnyPreview = requests?.some(r => r.freeform_preview_url);

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-3">공동구매 요청 관리</h2>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {['all', 'draft', 'pending', 'in_progress', 'design_shared', 'feedback', 'confirmed', 'session_created', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
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
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            {hasAnyPreview && <div className="w-10 shrink-0" />}
            <div className="flex-1 min-w-0 grid grid-cols-[1.2fr_0.6fr_0.8fr_1fr_1.2fr_0.5fr_0.7fr_0.7fr] gap-2">
              <span>단체명</span>
              <span className="text-center">상태</span>
              <span>요청자</span>
              <span>전화번호</span>
              <span>이메일</span>
              <span>수량</span>
              <span>희망 수령일</span>
              <span>요청일</span>
            </div>
            <div className="w-16 shrink-0" />
          </div>
          {requests.map(req => {
            const hasEmail = !!(req.guest_email || (req as any).profiles?.email);
            const canSendRemind = req.status === 'draft' && hasEmail;
            const isSending = sendingPricing === req.id;
            const isSent = sentPricing.has(req.id);

            return (
              <Link
                key={req.id}
                href={`/cobuy/requests/${req.id}`}
                className="block w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition"
              >
                <div className="flex items-center gap-2">
                  {hasAnyPreview && (
                    req.freeform_preview_url ? (
                      <div className="w-10 h-10 rounded-md bg-gray-50 overflow-hidden shrink-0 border border-gray-100">
                        <img src={req.freeform_preview_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 shrink-0" />
                    )
                  )}
                  <div className="flex-1 min-w-0 grid grid-cols-[1.2fr_0.6fr_0.8fr_1fr_1.2fr_0.5fr_0.7fr_0.7fr] gap-2 items-center">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                    <div className="text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[req.status]}`}>
                        {statusLabels[req.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{req.guest_name || (req as any).profiles?.name || '-'}</p>
                    <p className="text-xs text-gray-500 truncate">{req.guest_phone || (req as any).profiles?.phone || '-'}</p>
                    <p className="text-xs text-gray-500 truncate">{req.guest_email || (req as any).profiles?.email || '-'}</p>
                    <p className="text-xs text-gray-600">{(req.quantity_expectations as any)?.estimatedQuantity ? `${(req.quantity_expectations as any).estimatedQuantity}벌` : '-'}</p>
                    <p className="text-[10px] text-gray-400">{formatDateShort((req.schedule_preferences as any)?.receiveByDate)}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(req.created_at)}</p>
                  </div>
                  <div className="w-16 shrink-0 flex justify-center">
                    {canSendRemind && (
                      <button
                        onClick={(e) => handleSendPricing(e, req.id)}
                        disabled={isSending || isSent}
                        title={isSent ? '리마인드 발송됨' : '리마인드 메일 발송'}
                        className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                          isSent
                            ? 'bg-green-50 text-green-600 cursor-default'
                            : isSending
                              ? 'bg-gray-100 text-gray-400 cursor-wait'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {isSent ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : isSending ? (
                          <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                        <span className="text-[10px]">{isSent ? '발송됨' : '리마인드'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
