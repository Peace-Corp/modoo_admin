'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CoBuyParticipant, Factory, Order, OrderItem } from '@/types/types';
import { ChevronLeft, ChevronDown, MapPin, CreditCard, Package, Factory as FactoryIcon, Download, Share2, Copy, Check, Link2Off, RotateCcw, MessageSquare, Paperclip } from 'lucide-react';
import RefundModal from '@/components/orders/RefundModal';

type CoBuyParticipantSummary = Pick<
  CoBuyParticipant,
  | 'id'
  | 'cobuy_session_id'
  | 'name'
  | 'email'
  | 'phone'
  | 'selected_size'
  | 'payment_status'
  | 'payment_amount'
  | 'paid_at'
  | 'joined_at'
>;

interface OrderDetailProps {
  order: Order;
  onBack: () => void;
  onUpdate: () => void;
  onOrderUpdate: (order: Order) => void;
  factories: Factory[];
  canAssign: boolean;
  loadingFactories: boolean;
  isFactoryUser?: boolean;
}

export default function OrderDetail({
  order,
  onBack,
  onUpdate,
  onOrderUpdate,
  factories,
  canAssign,
  loadingFactories,
  isFactoryUser = false,
}: OrderDetailProps) {
  const router = useRouter();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>(order.assigned_manufacturer_id || '');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Factory-specific fields (admin can set these)
  const [deadline, setDeadline] = useState<string>(order.deadline ? order.deadline.split('T')[0] : '');
  const [factoryAmount, setFactoryAmount] = useState<string>(order.factory_amount?.toString() || '');
  const [factoryPaymentDate, setFactoryPaymentDate] = useState<string>(order.factory_payment_date ? order.factory_payment_date.split('T')[0] : '');
  const [factoryPaymentStatus, setFactoryPaymentStatus] = useState<string>(order.factory_payment_status || 'pending');
  const [cobuySession, setCobuySession] = useState<{ id: string; title: string } | null>(null);
  const [cobuyError, setCobuyError] = useState<string | null>(null);
  const [downloadingCobuyExcel, setDownloadingCobuyExcel] = useState(false);
  const [cobuyParticipantSessionId, setCobuyParticipantSessionId] = useState<string | null>(null);
  const [cobuyParticipants, setCobuyParticipants] = useState<CoBuyParticipantSummary[]>([]);
  const [loadingCobuyParticipants, setLoadingCobuyParticipants] = useState(false);
  const [cobuyParticipantsError, setCobuyParticipantsError] = useState<string | null>(null);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [factoryAccordionOpen, setFactoryAccordionOpen] = useState(true);

  // Share link state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    fetchOrderItems();
  }, [order.id]);

  useEffect(() => {
    fetchCobuySession();
  }, [order.id]);

  useEffect(() => {
    if (order.order_category !== 'cobuy') {
      setCobuyParticipantSessionId(null);
      setCobuyParticipants([]);
      setCobuyParticipantsError(null);
      setLoadingCobuyParticipants(false);
      return;
    }

    fetchCobuyParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.order_category]);

  useEffect(() => {
    setSelectedFactoryId(order.assigned_manufacturer_id || '');
  }, [order.assigned_manufacturer_id]);

  // Fetch existing share token on mount
  useEffect(() => {
    if (canAssign) {
      fetchShareToken();
    }
  }, [order.id, canAssign]);

  const fetchShareToken = async () => {
    try {
      const response = await fetch(`/api/admin/orders/share?orderId=${order.id}`);
      if (response.ok) {
        const { data } = await response.json();
        setShareUrl(data?.share_url || null);
      }
    } catch (error) {
      console.error('Error fetching share token:', error);
    }
  };

  const handleGenerateShareLink = async () => {
    setGeneratingShareLink(true);
    setShareError(null);
    try {
      const response = await fetch('/api/admin/orders/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || '공유 링크 생성에 실패했습니다.');
      }

      const { data } = await response.json();
      setShareUrl(data?.share_url || null);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : '공유 링크 생성에 실패했습니다.');
    } finally {
      setGeneratingShareLink(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleDisableShareLink = async () => {
    setGeneratingShareLink(true);
    setShareError(null);
    try {
      const response = await fetch(`/api/admin/orders/share?orderId=${order.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || '공유 링크 비활성화에 실패했습니다.');
      }

      setShareUrl(null);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : '공유 링크 비활성화에 실패했습니다.');
    } finally {
      setGeneratingShareLink(false);
    }
  };

  // Sync factory fields when order changes
  useEffect(() => {
    setDeadline(order.deadline ? order.deadline.split('T')[0] : '');
    setFactoryAmount(order.factory_amount?.toString() || '');
    setFactoryPaymentDate(order.factory_payment_date ? order.factory_payment_date.split('T')[0] : '');
    setFactoryPaymentStatus(order.factory_payment_status || 'pending');
  }, [order.factory_status, order.deadline, order.factory_amount, order.factory_payment_date, order.factory_payment_status]);

  const fetchOrderItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders/items?orderId=${order.id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '주문 상품을 불러오지 못했습니다.');
      }

      const payload = await response.json();
      setOrderItems(payload?.data || []);
    } catch (error) {
      console.error('Error fetching order items:', error);
      setOrderItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCobuySession = async () => {
    setCobuyError(null);
    try {
      const response = await fetch(`/api/admin/orders/cobuy-session?orderId=${order.id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '공동구매 정보를 불러오지 못했습니다.');
      }

      const payload = await response.json();
      setCobuySession(payload?.data || null);
    } catch (error) {
      console.error('Error fetching cobuy session:', error);
      setCobuySession(null);
      setCobuyError(error instanceof Error ? error.message : '공동구매 정보를 불러오지 못했습니다.');
    }
  };

  const fetchCobuyParticipants = async () => {
    setLoadingCobuyParticipants(true);
    setCobuyParticipantsError(null);

    try {
      const response = await fetch(`/api/admin/orders/cobuy-participants?orderId=${order.id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '공동구매 참여자 정보를 불러오지 못했습니다.');
      }

      const payload = await response.json();
      setCobuyParticipantSessionId(payload?.data?.sessionId ?? null);
      setCobuyParticipants(payload?.data?.participants || []);
    } catch (error) {
      console.error('Error fetching cobuy participants:', error);
      setCobuyParticipantSessionId(null);
      setCobuyParticipants([]);
      setCobuyParticipantsError(
        error instanceof Error ? error.message : '공동구매 참여자 정보를 불러오지 못했습니다.'
      );
    } finally {
      setLoadingCobuyParticipants(false);
    }
  };

  const handleDownloadCobuyExcel = async () => {
    setDownloadingCobuyExcel(true);
    setCobuyError(null);

    try {
      const response = await fetch(`/api/admin/orders/cobuy-excel?orderId=${order.id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '엑셀 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cobuy-order-${order.id}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading cobuy excel:', error);
      setCobuyError(error instanceof Error ? error.message : '엑셀 다운로드에 실패했습니다.');
    } finally {
      setDownloadingCobuyExcel(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const cobuyPaymentStatusLabel: Record<CoBuyParticipant['payment_status'], string> = {
    pending: '대기',
    completed: '완료',
    failed: '실패',
    refunded: '환불',
  };

  const subtotal = orderItems.reduce(
    (sum, item) => sum + (item.price_per_item ?? 0) * (item.quantity ?? 0),
    0
  );

  const factoryMap = useMemo(() => {
    const map = new Map<string, Factory>();
    factories.forEach((factory) => {
      if (factory.id) {
        map.set(factory.id, factory);
      }
    });
    return map;
  }, [factories]);

  const currentFactoryLabel = order.assigned_manufacturer_id
    ? factoryMap.get(order.assigned_manufacturer_id)?.name ||
      factoryMap.get(order.assigned_manufacturer_id)?.email ||
      order.assigned_manufacturer_id
    : '미배정';

  const handleAssignFactory = async () => {
    if (!canAssign) return;

    setAssigning(true);
    setAssignError(null);
    try {
      // Auto-set statuses when assigning a factory for the first time
      const isNewAssignment = selectedFactoryId && !order.assigned_manufacturer_id;

      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          factoryId: selectedFactoryId || null,
          deadline: deadline || null,
          factoryAmount: factoryAmount ? parseFloat(factoryAmount) : null,
          factoryPaymentDate: factoryPaymentDate || null,
          factoryPaymentStatus: factoryPaymentStatus || null,
          ...(isNewAssignment ? {
            factoryStatus: 'assigned',
            orderStatus: 'in_production',
          } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 배정에 실패했습니다.');
      }

      const payload = await response.json();
      if (payload?.data) {
        onOrderUpdate(payload.data as Order);
        onUpdate();
      }
    } catch (error) {
      console.error('Error assigning factory:', error);
      setAssignError(error instanceof Error ? error.message : '공장 배정에 실패했습니다.');
    } finally {
      setAssigning(false);
    }
  };

  const handleItemClick = useCallback((itemId: string) => {
    router.push(`/orders/${order.id}/items/${itemId}`);
  }, [router, order.id]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">주문 상세</h2>
            <p className="text-sm text-gray-500 mt-1">주문 ID: {order.id}</p>
          </div>
        </div>

        {/* Share Link Button - Admin only, requires factory assignment */}
        {canAssign && order.assigned_manufacturer_id && (
          <div className="flex items-center gap-2">
            {shareUrl ? (
              <>
                <button
                  onClick={handleCopyShareLink}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      공유 링크 복사
                    </>
                  )}
                </button>
                <button
                  onClick={handleDisableShareLink}
                  disabled={generatingShareLink}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-60"
                  title="공유 링크 비활성화"
                >
                  <Link2Off className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerateShareLink}
                disabled={generatingShareLink}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-60"
              >
                <Share2 className="w-4 h-4" />
                {generatingShareLink ? '생성 중...' : '공유 링크 생성'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Share Error */}
      {shareError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {shareError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Order Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Items */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-3">주문 상품</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {orderItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    className="flex gap-4 p-3 border border-gray-200 rounded-md hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.product_title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-black">{item.product_title}</h4>
                      {item.products?.product_code && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          상품코드: {item.products.product_code}
                        </p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">수량: {item.quantity}</span>
                        {/* Hide price from factory users */}
                        {!isFactoryUser && (
                          <span className="font-semibold text-gray-900">
                            {((item.price_per_item ?? 0) * (item.quantity ?? 0)).toLocaleString()}원
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Customer Note & Attachments */}
          {(order.customer_note || (order.attachment_urls && order.attachment_urls.length > 0)) && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              {order.customer_note && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">고객 요청사항</h3>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.customer_note}</p>
                </div>
              )}
              {order.attachment_urls && order.attachment_urls.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-4 h-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">첨부파일 ({order.attachment_urls.length})</h3>
                  </div>
                  <div className="space-y-1.5">
                    {order.attachment_urls.map((url, index) => {
                      const filename = url.split('/').pop() || `첨부파일 ${index + 1}`;
                      return (
                        <a
                          key={index}
                          href={url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-4 h-4 shrink-0" />
                          <span className="truncate">{decodeURIComponent(filename)}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CoBuy participant information - hidden for factory users (contains personal info) */}
          {order.order_category === 'cobuy' && !isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">공동구매 참여자</h3>
                  {cobuySession && (
                    <p className="text-xs text-gray-500 mt-1">{cobuySession.title}</p>
                  )}
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={fetchCobuyParticipants}
                    disabled={loadingCobuyParticipants}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {loadingCobuyParticipants ? '불러오는 중...' : '새로고침'}
                  </button>
                  <button
                    onClick={handleDownloadCobuyExcel}
                    disabled={downloadingCobuyExcel}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-60"
                    title={`공동구매 참여자 엑셀 다운로드 (${cobuySession?.title})`}
                  >
                    <Download className="w-4 h-4" />
                    {downloadingCobuyExcel ? '다운로드 중...' : '공동구매 엑셀 다운로드'}
                  </button>
                </div>
              </div>

              {cobuyParticipantsError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
                  {cobuyParticipantsError}
                </div>
              )}

              {loadingCobuyParticipants ? (
                <div className="text-sm text-gray-500">불러오는 중...</div>
              ) : cobuyParticipants.length === 0 ? (
                <div className="text-sm text-gray-500">
                  {cobuyParticipantSessionId ? '참여자가 없습니다.' : '세션 정보를 찾을 수 없습니다.'}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500">총 {cobuyParticipants.length}명</div>
                  <div className="space-y-2">
                    {cobuyParticipants.map((participant) => (
                      <div key={participant.id} className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                            <div className="mt-1 text-xs text-gray-600">{participant.email}</div>
                            <div className="text-xs text-gray-600">{participant.phone || '-'}</div>
                          </div>
                          <div className="text-right text-xs text-gray-600">
                            <div>
                              {cobuyPaymentStatusLabel[participant.payment_status] || participant.payment_status}
                            </div>
                            <div className="mt-1">사이즈: {participant.selected_size || '-'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order Summary - hidden for factory users (contains actual prices) */}
          {!isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">주문 요약</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">소계</span>
                  <span className="font-medium text-gray-900">{subtotal.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">배송비</span>
                  <span className="font-medium text-gray-900">
                    {(order.delivery_fee ?? 0).toLocaleString()}원
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-base font-semibold text-gray-900">총 금액</span>
                  <span className="text-base font-bold text-blue-600">
                    {(order.total_amount ?? 0).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Factory Assignment */}
          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm">
            <button
              onClick={() => setFactoryAccordionOpen(!factoryAccordionOpen)}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <FactoryIcon className="w-5 h-5 text-gray-600" />
                <h3 className="text-base font-semibold text-gray-900">공장 배정</h3>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${factoryAccordionOpen ? 'rotate-180' : ''}`} />
            </button>
            {factoryAccordionOpen && (
              <div className="px-4 pb-4 space-y-3 text-sm">
              <div>
                <p className="text-sm text-gray-500">현재 배정</p>
                <p className="font-medium text-gray-900">{currentFactoryLabel}</p>
              </div>

              {/* Factory assignment status badge */}
              {order.assigned_manufacturer_id && (
                <div>
                  <p className="text-sm text-gray-500">공장 배정 상태</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                    order.factory_status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                    order.factory_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    order.factory_status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.factory_status === 'shipped' ? 'bg-indigo-100 text-indigo-800' :
                    order.factory_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.factory_status === 'pending' ? '대기중' :
                     order.factory_status === 'assigned' ? '배정완료' :
                     order.factory_status === 'in_progress' ? '작업중' :
                     order.factory_status === 'completed' ? '작업완료' :
                     order.factory_status === 'shipped' ? '출고완료' :
                     order.factory_status === 'cancelled' ? '취소' : '대기중'}
                  </span>
                </div>
              )}

              {canAssign && (
                <>
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">공장 선택</label>
                    <select
                      value={selectedFactoryId}
                      onChange={(event) => setSelectedFactoryId(event.target.value)}
                      disabled={loadingFactories || assigning}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">미배정</option>
                      {factories.map((factory) => (
                        <option key={factory.id} value={factory.id}>
                          {factory.name || factory.email || factory.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">마감일</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      disabled={assigning}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">금액 (공장 배정 금액)</label>
                    <input
                      type="number"
                      value={factoryAmount}
                      onChange={(event) => setFactoryAmount(event.target.value)}
                      disabled={assigning}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">결제 예정일</label>
                    <input
                      type="date"
                      value={factoryPaymentDate}
                      onChange={(event) => setFactoryPaymentDate(event.target.value)}
                      disabled={assigning}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <button
                    onClick={handleAssignFactory}
                    disabled={assigning || loadingFactories}
                    className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {assigning ? '저장 중...' : '저장'}
                  </button>

                  {/* 결제 상태 — only shown after factory is assigned */}
                  {order.assigned_manufacturer_id && (
                    <div className="border-t border-gray-200 pt-3 mt-1">
                      <label className="block text-sm text-gray-500 mb-1">결제 상태</label>
                      <div className="flex gap-2">
                        <select
                          value={factoryPaymentStatus}
                          onChange={(event) => setFactoryPaymentStatus(event.target.value)}
                          disabled={assigning}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                        >
                          <option value="pending">대기</option>
                          <option value="completed">완료</option>
                          <option value="cancelled">취소</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              {assignError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                  {assignError}
                </div>
              )}
            </div>
            )}
          </div>

        </div>

        {/* Right Column - Customer & Shipping Info (hidden for factory users) */}
        <div className="space-y-4">
          {/* Customer & Shipping Information - hidden for factory users */}
          {!isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">고객 정보</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">이름</p>
                  <p className="font-medium text-gray-900">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">이메일</p>
                  <p className="font-medium text-gray-900">{order.customer_email}</p>
                </div>
                {order.customer_phone && (
                  <div>
                    <p className="text-sm text-gray-500">전화번호</p>
                    <p className="font-medium text-gray-900">{order.customer_phone}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <h3 className="text-base font-semibold text-gray-900">배송 정보</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">배송 방법</p>
                    <p className="font-medium text-gray-900">
                      {order.shipping_method === 'pickup' ? '직접 수령' :
                       order.shipping_method === 'domestic' ? '국내 배송' :
                       order.shipping_method === 'international' ? '해외 배송' :
                       order.shipping_method || '-'}
                    </p>
                  </div>
                  {order.shipping_method === 'international' && order.country_code && (
                    <div>
                      <p className="text-sm text-gray-500">국가</p>
                      <p className="font-medium text-gray-900">{order.country_code}</p>
                    </div>
                  )}
                  {(order.postal_code || order.address_line_1) && (
                    <div>
                      <p className="text-sm text-gray-500">주소</p>
                      <p className="font-medium text-gray-900">
                        {order.postal_code && `[${order.postal_code}] `}
                        {order.address_line_1}
                        {order.address_line_2 && ` ${order.address_line_2}`}
                      </p>
                    </div>
                  )}
                  {order.shipping_method === 'international' && (order.state || order.city) && (
                    <div>
                      <p className="text-sm text-gray-500">지역</p>
                      <p className="font-medium text-gray-900">
                        {[order.state, order.city].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment Information - hidden for factory users */}
          {!isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <h3 className="text-base font-semibold text-gray-900">결제 정보</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">결제 수단</p>
                  <p className="font-medium text-gray-900">
                    {order.payment_method === 'toss'
                      ? '토스페이'
                      : order.payment_method === 'paypal'
                      ? 'PayPal'
                      : '카드'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">결제 상태</p>
                  <p className="font-medium text-gray-900">{order.payment_status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">주문 상태</p>
                  <p className="font-medium text-gray-900">{order.order_status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">주문 일시</p>
                  <p className="font-medium text-gray-900">{formatDate(order.created_at)}</p>
                </div>
                {order.refund_reason && (
                  <div>
                    <p className="text-sm text-gray-500">환불 사유</p>
                    <p className="font-medium text-red-600">{order.refund_reason}</p>
                  </div>
                )}
                {order.payment_status === 'completed' && (
                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors mt-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    환불 처리
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Factory Order Info - shown only for factory users */}
          {isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <h3 className="text-base font-semibold text-gray-900">주문 정보</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">주문 구분</p>
                  <p className="font-medium text-gray-900">
                    {order.order_category === 'cobuy' ? '공동구매' : '일반'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">공장 배정 상태</p>
                  <select
                    value={order.factory_status || 'assigned'}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        const response = await fetch('/api/admin/orders', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: order.id, factoryStatus: newStatus }),
                        });
                        if (!response.ok) {
                          const payload = await response.json().catch(() => ({}));
                          throw new Error(payload?.error || '상태 변경에 실패했습니다.');
                        }
                        const { data } = await response.json();
                        onOrderUpdate(data as Order);
                        onUpdate();
                      } catch (error) {
                        alert(error instanceof Error ? error.message : '상태 변경에 실패했습니다.');
                      }
                    }}
                    disabled={order.factory_status === 'shipped'}
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 ${
                      order.factory_status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                      order.factory_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      order.factory_status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.factory_status === 'shipped' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <option value="assigned">배정완료</option>
                    <option value="in_progress">작업중</option>
                    <option value="completed">작업완료</option>
                    <option value="shipped">출고완료</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm text-gray-500">마감일</p>
                  <p className="font-medium text-gray-900">
                    {order.deadline ? formatDate(order.deadline) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">금액</p>
                  <p className="font-medium text-gray-900">
                    {order.factory_amount ? `${order.factory_amount.toLocaleString()}원` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">결제 예정일</p>
                  <p className="font-medium text-gray-900">
                    {order.factory_payment_date ? formatDate(order.factory_payment_date) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">결제 상태</p>
                  <p className="font-medium text-gray-900">
                    {order.factory_payment_status === 'pending' ? '대기' :
                     order.factory_payment_status === 'completed' ? '완료' :
                     order.factory_payment_status === 'cancelled' ? '취소' : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {cobuyError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {cobuyError}
            </div>
          )}

        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <RefundModal
          order={order}
          onClose={() => setShowRefundModal(false)}
          onSuccess={() => {
            setShowRefundModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
