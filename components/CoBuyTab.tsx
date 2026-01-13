'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ChevronLeft, ClipboardList, Plus, RefreshCw } from 'lucide-react';
import { CoBuyParticipant, CoBuySession, CoBuyStatus } from '@/types/types';
import AdminCoBuyCreator from './cobuy/AdminCoBuyCreator';

const statusLabels: Record<CoBuyStatus, string> = {
  open: '진행중',
  closed: '마감',
  finalized: '확정',
  cancelled: '취소',
  gathering: '모집중',
  gather_complete: '모집완료',
  order_complete: '주문완료',
  manufacturing: '제작중',
  manufacture_complete: '제작완료',
  delivering: '배송중',
  delivery_complete: '배송완료',
};

const statusColors: Record<CoBuyStatus, string> = {
  open: 'bg-green-100 text-green-800',
  closed: 'bg-yellow-100 text-yellow-800',
  finalized: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  gathering: 'bg-green-100 text-green-800',
  gather_complete: 'bg-teal-100 text-teal-800',
  order_complete: 'bg-indigo-100 text-indigo-800',
  manufacturing: 'bg-purple-100 text-purple-800',
  manufacture_complete: 'bg-violet-100 text-violet-800',
  delivering: 'bg-orange-100 text-orange-800',
  delivery_complete: 'bg-emerald-100 text-emerald-800',
};

const paymentStatusLabels: Record<CoBuyParticipant['payment_status'], string> = {
  pending: '대기',
  completed: '완료',
  failed: '실패',
  refunded: '환불',
};

const paymentStatusColors: Record<CoBuyParticipant['payment_status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${value.toLocaleString()}원`;
};

const renderFieldResponses = (responses?: Record<string, unknown> | null) => {
  if (!responses || Object.keys(responses).length === 0) {
    return '-';
  }

  return (
    <details className="text-xs text-gray-600">
      <summary className="cursor-pointer">보기</summary>
      <pre className="mt-2 whitespace-pre-wrap text-[11px] text-gray-700">
        {JSON.stringify(responses, null, 2)}
      </pre>
    </details>
  );
};

export default function CoBuyTab() {
  const [sessions, setSessions] = useState<CoBuySession[]>([]);
  const [participants, setParticipants] = useState<CoBuyParticipant[]>([]);
  const [selectedSession, setSelectedSession] = useState<CoBuySession | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | CoBuyStatus>('all');
  const [statusUpdate, setStatusUpdate] = useState<CoBuyStatus>('open');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'status' | 'bulk' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [filterStatus]);

  const fetchSessions = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/cobuy/sessions?status=${filterStatus}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공동구매 세션을 불러오지 못했습니다.');
      }

      const payload = await response.json();
      setSessions(payload?.data || []);
    } catch (error) {
      console.error('Error fetching CoBuy sessions:', error);
      setSessions([]);
      setErrorMessage(error instanceof Error ? error.message : '공동구매 세션을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (sessionId: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetch(`/api/admin/cobuy/participants?sessionId=${sessionId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '참여자 정보를 불러오지 못했습니다.');
      }

      const payload = await response.json();
      setParticipants(payload?.data || []);
    } catch (error) {
      console.error('Error fetching CoBuy participants:', error);
      setParticipants([]);
      setDetailError(error instanceof Error ? error.message : '참여자 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectSession = (session: CoBuySession) => {
    setSelectedSession(session);
    setStatusUpdate(session.status);
    fetchParticipants(session.id);
  };

  const handleUpdateStatus = async () => {
    if (!selectedSession) return;

    setActionLoading('status');
    setDetailError(null);

    try {
      const response = await fetch('/api/admin/cobuy/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession.id, status: statusUpdate }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '상태 업데이트에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedSession = payload?.data as CoBuySession;

      setSelectedSession(updatedSession);
      setSessions((prev) =>
        prev.map((session) => (session.id === updatedSession.id ? updatedSession : session))
      );
    } catch (error) {
      console.error('Error updating session status:', error);
      setDetailError(error instanceof Error ? error.message : '상태 업데이트에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBulkOrder = async () => {
    if (!selectedSession) return;

    setActionLoading('bulk');
    setDetailError(null);

    try {
      const response = await fetch('/api/admin/cobuy/bulk-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession.id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공동구매 주문 생성에 실패했습니다.');
      }

      const payload = await response.json();
      const orderId = payload?.data?.orderId as string | undefined;

      if (!orderId) {
        throw new Error('주문 ID를 확인할 수 없습니다.');
      }

      const updatedSession = {
        ...selectedSession,
        bulk_order_id: orderId,
      };

      setSelectedSession(updatedSession);
      setSessions((prev) =>
        prev.map((session) => (session.id === updatedSession.id ? updatedSession : session))
      );
    } catch (error) {
      console.error('Error creating bulk order:', error);
      setDetailError(error instanceof Error ? error.message : '공동구매 주문 생성에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const paymentStats = useMemo(() => {
    const total = participants.length;
    const completed = participants.filter((participant) => participant.payment_status === 'completed');
    const failed = participants.filter((participant) => participant.payment_status === 'failed');
    const refunded = participants.filter((participant) => participant.payment_status === 'refunded');
    const pendingCount = total - completed.length - failed.length - refunded.length;
    const totalPaid = completed.reduce((sum, participant) => {
      const amount = typeof participant.payment_amount === 'number' ? participant.payment_amount : 0;
      return sum + amount;
    }, 0);

    return {
      total,
      completed: completed.length,
      failed: failed.length,
      refunded: refunded.length,
      pending: pendingCount,
      totalPaid,
    };
  }, [participants]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedSession(null)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">공동구매 상세</h2>
            <p className="text-sm text-gray-500 mt-1">세션 ID: {selectedSession.id}</p>
          </div>
        </div>

        {detailError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{detailError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedSession.title}</h3>
                  {selectedSession.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedSession.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedSession.profiles?.email || 'creator@unknown'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedSession.status]}`}
                >
                  {statusLabels[selectedSession.status]}
                </span>
              </div>

              {selectedSession.status === 'cancelled' && (
                <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  취소 요청 또는 취소 처리된 세션입니다. 필요 시 상태를 조정하세요.
                </div>
              )}
              {selectedSession.cancellation_requested_at && (
                <div className="rounded-md border border-yellow-100 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                  취소 요청 접수: {formatDate(selectedSession.cancellation_requested_at)}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(selectedSession.start_date)} - {formatDate(selectedSession.end_date)}
                </div>
                <div className="text-gray-700">
                  참여자: {selectedSession.current_participant_count || 0}
                  {selectedSession.max_participants !== null
                    ? ` / ${selectedSession.max_participants}`
                    : ' / 무제한'}
                </div>
                <div className="text-gray-700">공유 토큰: {selectedSession.share_token}</div>
                <div className="text-gray-700">
                  주문 ID: {selectedSession.bulk_order_id || '-'}
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">참여자 목록</h3>
                <button
                  onClick={() => fetchParticipants(selectedSession.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={detailLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${detailLoading ? 'animate-spin' : ''}`} />
                  새로고침
                </button>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          참여자
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          연락처
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          사이즈
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          결제 상태
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          결제 금액
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          응답
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          참여일
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {participants.map((participant) => (
                        <tr key={participant.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                            <div className="text-xs text-gray-500">{participant.email}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {participant.phone || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {participant.selected_size}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[participant.payment_status]}`}
                            >
                              {paymentStatusLabels[participant.payment_status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {formatCurrency(participant.payment_amount ?? undefined)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {renderFieldResponses(participant.field_responses)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(participant.joined_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!detailLoading && participants.length === 0 && (
                <div className="text-center py-10">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">참여자가 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">결제 현황</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">총 참여</span>
                  <span className="font-medium text-gray-900">{paymentStats.total}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">결제 완료</span>
                  <span className="font-medium text-gray-900">{paymentStats.completed}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">대기</span>
                  <span className="font-medium text-gray-900">{paymentStats.pending}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">실패</span>
                  <span className="font-medium text-gray-900">{paymentStats.failed}명</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">환불</span>
                  <span className="font-medium text-gray-900">{paymentStats.refunded}명</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-gray-700 font-semibold">총 결제 금액</span>
                  <span className="text-blue-600 font-bold">
                    {formatCurrency(paymentStats.totalPaid)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm space-y-4">
              <h3 className="text-base font-semibold text-gray-900">관리 액션</h3>

              <div className="space-y-2">
                <label className="text-sm text-gray-600">세션 상태 변경</label>
                <div className="flex gap-2">
                  <select
                    value={statusUpdate}
                    onChange={(event) => setStatusUpdate(event.target.value as CoBuyStatus)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {Object.keys(statusLabels).map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status as CoBuyStatus]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={actionLoading === 'status'}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {actionLoading === 'status' ? '처리중...' : '업데이트'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600">일괄 주문 생성</label>
                <button
                  onClick={handleCreateBulkOrder}
                  disabled={actionLoading === 'bulk' || !!selectedSession.bulk_order_id || selectedSession.status !== 'finalized'}
                  className="w-full px-3 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedSession.bulk_order_id
                    ? '주문 생성 완료'
                    : actionLoading === 'bulk'
                    ? '주문 생성중...'
                    : '주문 생성하기'}
                </button>
                <p className="text-xs text-gray-500">
                  확정된 세션에서만 주문을 생성할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCoBuyCreated = (session: CoBuySession) => {
    setSessions((prev) => [session, ...prev]);
  };

  // Show the creator modal
  if (showCreator) {
    return (
      <AdminCoBuyCreator
        onClose={() => setShowCreator(false)}
        onSuccess={(session) => {
          handleCoBuyCreated(session);
          setShowCreator(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">공동구매 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {sessions.length}개의 세션</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            공동구매 생성하기
          </button>
          <button
            onClick={fetchSessions}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200/60 rounded-md p-3 shadow-sm">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: '전체' },
            { value: 'open', label: '진행중' },
            { value: 'closed', label: '마감' },
            { value: 'finalized', label: '확정' },
            { value: 'cancelled', label: '취소' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value as 'all' | CoBuyStatus)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterStatus === filter.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  세션
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  참여자
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  기간
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문 ID
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{session.title}</div>
                    <div className="text-xs text-gray-500">
                      {session.profiles?.email || 'creator@unknown'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[session.status]}`}
                    >
                      {statusLabels[session.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {session.current_participant_count || 0}
                    {session.max_participants !== null ? ` / ${session.max_participants}` : ' / 무제한'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {formatDate(session.start_date)} - {formatDate(session.end_date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {session.bulk_order_id || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-12">
            <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">세션이 없습니다</h3>
            <p className="text-gray-500">등록된 공동구매 세션이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
