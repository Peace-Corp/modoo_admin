'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CoBuyParticipant, Factory, Order, OrderItem } from '@/types/types';
import { ChevronLeft, ChevronDown, CreditCard, Package, Factory as FactoryIcon, Download, Share2, Copy, Check, Link2Off, RotateCcw, MessageSquare, User, Receipt, Truck, Link2, Pencil, X, Loader2 } from 'lucide-react';
import RefundModal from '@/components/orders/RefundModal';
import DesignChatPanel from '@/components/orders/DesignChatPanel';
import OrderAttachmentSection from '@/components/orders/OrderAttachmentSection';
import { extractVariants } from '@/lib/orderUtils';

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
  const [factoryAccordionOpen, setFactoryAccordionOpen] = useState(false);
  const [chatItemId, setChatItemId] = useState<string | null>(null);
  const [localAttachmentUrls, setLocalAttachmentUrls] = useState<string[]>(order.attachment_urls || []);

  // Share link state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [updatingFactoryStatus, setUpdatingFactoryStatus] = useState(false);

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

  const handleFactoryStatusChange = async (newStatus: string) => {
    setUpdatingFactoryStatus(true);
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
      console.error('Error updating factory status:', error);
      setAssignError(error instanceof Error ? error.message : '상태 변경에 실패했습니다.');
    } finally {
      setUpdatingFactoryStatus(false);
    }
  };

  const handleItemClick = useCallback((itemId: string) => {
    router.push(`/orders/${order.id}/items/${itemId}`);
  }, [router, order.id]);

  const orderStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      payment_completed: '결제완료', in_production: '생산중', shipping: '배송중',
      delivered: '배송완료', cancelled: '취소', partially_cancelled: '부분취소',
    };
    return map[status] || status;
  };

  const orderStatusColor = (status: string) => {
    const map: Record<string, string> = {
      payment_completed: 'bg-green-100 text-green-800',
      in_production: 'bg-yellow-100 text-yellow-800',
      shipping: 'bg-blue-100 text-blue-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      partially_cancelled: 'bg-orange-100 text-orange-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const paymentStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: '입금대기', completed: '완료', failed: '실패', refunded: '환불',
    };
    return map[status] || status;
  };

  const paymentStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-purple-100 text-purple-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const factoryStatusLabel = (status: string | null) => {
    if (!status) return '대기중';
    const map: Record<string, string> = {
      pending: '대기중', assigned: '배정완료', in_progress: '작업중',
      completed: '작업완료', shipped: '출고완료', cancelled: '취소',
    };
    return map[status] || '대기중';
  };

  const factoryStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    const map: Record<string, string> = {
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

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
            <p className="text-sm text-gray-500 mt-0.5">주문 ID: {order.id}</p>
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
                    <><Check className="w-4 h-4" />복사됨</>
                  ) : (
                    <><Copy className="w-4 h-4" />공유 링크 복사</>
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

      {/* Status Overview Bar */}
      {!isFactoryUser && (
        <div className="bg-white border border-gray-200/60 rounded-md p-3 shadow-sm flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">주문</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${orderStatusColor(order.order_status)}`}>
              {orderStatusLabel(order.order_status)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">결제</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusColor(order.payment_status)}`}>
              {paymentStatusLabel(order.payment_status)}
            </span>
          </div>
          {order.assigned_manufacturer_id && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">공장</span>
              <select
                value={order.factory_status || 'pending'}
                onChange={(e) => handleFactoryStatusChange(e.target.value)}
                disabled={updatingFactoryStatus}
                className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 ${factoryStatusColor(order.factory_status)}`}
              >
                <option value="pending">대기중</option>
                <option value="assigned">배정완료</option>
                <option value="in_progress">작업중</option>
                <option value="completed">작업완료</option>
                <option value="shipped">출고완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">구분</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${order.order_category === 'cobuy' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}`}>
              {order.order_category === 'cobuy' ? '공동구매' : '일반'}
            </span>
          </div>
          <div className="ml-auto text-xs text-gray-400">
            {formatDate(order.created_at)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Order Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Items */}
          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <Package className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">주문 상품</h3>
              {!loading && <span className="text-xs text-gray-400">({orderItems.length})</span>}
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`flex gap-4 p-3 rounded-md cursor-pointer transition-all ${
                        item.retouch_requested
                          ? 'border-2 border-orange-400 bg-orange-50/30 hover:border-orange-500 hover:bg-orange-50/50'
                          : 'border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                      }`}
                    >
                      <div className="w-20 h-20 bg-gray-100 rounded shrink-0 overflow-hidden">
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-black">{item.product_title}</h4>
                          {item.retouch_requested && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded">
                              리터치 요청
                            </span>
                          )}
                        </div>
                        {item.products?.product_code && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            상품코드: {item.products.product_code}
                          </p>
                        )}
                        {/* Size/Variant breakdown */}
                        {(() => {
                          const variants = extractVariants(item);
                          return variants.length > 1 ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {variants.filter(v => (v.quantity ?? 0) > 0).map((v, vi) => (
                                <span key={vi} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                  {v.color_hex && <span className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: v.color_hex }} />}
                                  {v.size_name && <span>{v.size_name}</span>}
                                  <span className="font-medium">x{v.quantity}</span>
                                </span>
                              ))}
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 rounded text-xs font-semibold text-blue-700">
                                합계: {item.quantity}
                              </span>
                            </div>
                          ) : null;
                        })()}
                        <div className="flex justify-between items-center mt-2">
                          {(() => {
                            const variants = extractVariants(item);
                            if (variants.length <= 1) {
                              const v = variants[0];
                              const label = v?.size_name;
                              return <span className="text-sm text-gray-600">수량: {label ? `${label} ` : ''}{item.quantity}</span>;
                            }
                            return <span className="text-sm text-gray-600">총 수량: {item.quantity}</span>;
                          })()}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatItemId(chatItemId === item.id ? null : item.id);
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                chatItemId === item.id
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'hover:bg-gray-100 text-gray-400 hover:text-blue-600'
                              }`}
                              title="디자인 소통"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            {!isFactoryUser && (
                              <span className="font-semibold text-gray-900">
                                {((item.price_per_item ?? 0) * (item.quantity ?? 0)).toLocaleString()}원
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Design Chat Panel */}
          {chatItemId && (
            <DesignChatPanel
              orderItemId={chatItemId}
              productTitle={orderItems.find((i) => i.id === chatItemId)?.product_title}
              designTitle={orderItems.find((i) => i.id === chatItemId)?.design_title || undefined}
              onClose={() => setChatItemId(null)}
            />
          )}

          {/* Customer Note & Attachments */}
          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-amber-50/50">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-900">고객 요청사항 / 첨부파일</h3>
            </div>
            <div className="p-4 space-y-3">
              {order.customer_note && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.customer_note}</p>
              )}
              {order.customer_note && <div className="border-t border-gray-100 pt-3" />}
              <OrderAttachmentSection
                orderId={order.id}
                attachmentUrls={localAttachmentUrls}
                onUrlsUpdated={setLocalAttachmentUrls}
                isAdmin={!isFactoryUser}
              />
            </div>
          </div>

          {/* CoBuy participant information - hidden for factory users (contains personal info) */}
          {order.order_category === 'cobuy' && !isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-purple-50/50">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-900">공동구매 참여자</h3>
                  {cobuySession && (
                    <span className="text-xs text-gray-400">{cobuySession.title}</span>
                  )}
                </div>
                <div className="flex gap-2">
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-60"
                    title={`공동구매 참여자 엑셀 다운로드 (${cobuySession?.title})`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingCobuyExcel ? '다운로드 중...' : '엑셀 다운로드'}
                  </button>
                </div>
              </div>
              <div className="p-4">
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
            </div>
          )}

          {/* Order Summary - hidden for factory users */}
          {!isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <Receipt className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">주문 요약</h3>
              </div>
              <div className="p-4 space-y-3">
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
                  <span className="text-sm font-semibold text-gray-900">총 금액</span>
                  <span className="text-base font-bold text-blue-600">
                    {(order.total_amount ?? 0).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Factory Assignment */}
          <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
            <button
              onClick={() => setFactoryAccordionOpen(!factoryAccordionOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/50 border-b border-gray-100"
            >
              <div className="flex items-center gap-2">
                <FactoryIcon className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">공장 배정</h3>
                {order.assigned_manufacturer_id && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${factoryStatusColor(order.factory_status)}`}>
                    {factoryStatusLabel(order.factory_status)}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${factoryAccordionOpen ? 'rotate-180' : ''}`} />
            </button>
            {factoryAccordionOpen && (
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">현재 배정</p>
                  <p className="font-medium text-gray-900">{currentFactoryLabel}</p>
                </div>

                {canAssign && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">공장 선택</label>
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
                      <label className="block text-xs text-gray-500 mb-1">마감일</label>
                      <input
                        type="date"
                        value={deadline}
                        onChange={(event) => setDeadline(event.target.value)}
                        disabled={assigning}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">금액 (공장 배정 금액)</label>
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
                      <label className="block text-xs text-gray-500 mb-1">결제 예정일</label>
                      <input
                        type="date"
                        value={factoryPaymentDate}
                        onChange={(event) => setFactoryPaymentDate(event.target.value)}
                        disabled={assigning}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                      />
                    </div>

                    {/* 결제 상태 — only shown after factory is assigned */}
                    {order.assigned_manufacturer_id && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">결제 상태</label>
                        <select
                          value={factoryPaymentStatus}
                          onChange={(event) => setFactoryPaymentStatus(event.target.value)}
                          disabled={assigning}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50"
                        >
                          <option value="pending">대기</option>
                          <option value="completed">완료</option>
                          <option value="cancelled">취소</option>
                        </select>
                      </div>
                    )}

                    <button
                      onClick={handleAssignFactory}
                      disabled={assigning || loadingFactories}
                      className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
                    >
                      {assigning ? '저장 중...' : '저장'}
                    </button>
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

        {/* Right Column */}
        <div className="space-y-4">
          {/* Customer Info - hidden for factory users */}
          {!isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <User className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">고객 정보</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500">이름</p>
                  <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">이메일</p>
                  <p className="text-sm font-medium text-gray-900">{order.customer_email}</p>
                </div>
                {order.customer_phone && (
                  <div>
                    <p className="text-xs text-gray-500">전화번호</p>
                    <p className="text-sm font-medium text-gray-900">{order.customer_phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shipping Info - hidden for factory users */}
          {!isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <Truck className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">배송 정보</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500">배송 방법</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.shipping_method === 'pickup' ? '직접 수령' :
                     order.shipping_method === 'domestic' ? '국내 배송' :
                     order.shipping_method === 'international' ? '해외 배송' :
                     order.shipping_method || '-'}
                  </p>
                </div>
                {order.shipping_method === 'international' && order.country_code && (
                  <div>
                    <p className="text-xs text-gray-500">국가</p>
                    <p className="text-sm font-medium text-gray-900">{order.country_code}</p>
                  </div>
                )}
                {(order.postal_code || order.address_line_1) && (
                  <div>
                    <p className="text-xs text-gray-500">주소</p>
                    <p className="text-sm font-medium text-gray-900">
                      {order.postal_code && `[${order.postal_code}] `}
                      {order.address_line_1}
                      {order.address_line_2 && ` ${order.address_line_2}`}
                    </p>
                  </div>
                )}
                {order.shipping_method === 'international' && (order.state || order.city) && (
                  <div>
                    <p className="text-xs text-gray-500">지역</p>
                    <p className="text-sm font-medium text-gray-900">
                      {[order.state, order.city].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Information - hidden for factory users */}
          {!isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">결제 정보</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500">결제 수단</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.payment_method === 'toss'
                      ? '토스페이'
                      : order.payment_method === 'paypal'
                      ? 'PayPal'
                      : order.payment_method === 'admin'
                      ? '관리자 처리'
                      : order.payment_method === 'bank_transfer'
                      ? '무통장입금'
                      : order.payment_method === 'free'
                      ? '무료'
                      : '카드'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">결제 상태</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${paymentStatusColor(order.payment_status)}`}>
                    {paymentStatusLabel(order.payment_status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">주문 일시</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(order.created_at)}</p>
                </div>
                {/* Pricing adjustments info */}
                {(order.original_amount != null && order.original_amount !== order.total_amount) && (
                  <div className="pt-2 border-t border-gray-100 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">원래 금액</span>
                      <span className="text-gray-700">{order.original_amount.toLocaleString()}원</span>
                    </div>
                    {order.coupon_discount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600">쿠폰 할인</span>
                        <span className="text-green-600">-{order.coupon_discount.toLocaleString()}원</span>
                      </div>
                    )}
                    {order.admin_discount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-600">임의 할인</span>
                        <span className="text-orange-600">-{order.admin_discount.toLocaleString()}원</span>
                      </div>
                    )}
                    {order.admin_surcharge > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-600">추가 금액</span>
                        <span className="text-purple-600">+{order.admin_surcharge.toLocaleString()}원</span>
                      </div>
                    )}
                    {order.pricing_note && (
                      <div className="text-xs text-gray-500 italic mt-1">메모: {order.pricing_note}</div>
                    )}
                  </div>
                )}
                {order.refund_reason && (
                  <div>
                    <p className="text-xs text-gray-500">환불 사유</p>
                    <p className="text-sm font-medium text-red-600">{order.refund_reason}</p>
                  </div>
                )}
                {/* Manual payment confirmation for pending orders */}
                {order.payment_status === 'pending' && (order.payment_method === 'bank_transfer' || order.payment_method === 'toss') && (
                  <button
                    onClick={async () => {
                      if (!confirm('이 주문의 결제를 완료 처리하시겠습니까?')) return;
                      try {
                        const res = await fetch('/api/admin/orders', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: order.id, payment_status: 'completed' }),
                        });
                        if (res.ok) {
                          onOrderUpdate({ ...order, payment_status: 'completed' });
                          onUpdate();
                        }
                      } catch (e) {
                        console.error('Failed to update payment status:', e);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors mt-2"
                  >
                    <Check className="w-4 h-4" />
                    결제 완료 처리
                  </button>
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

          {/* Bank Transfer Invoice Request Info */}
          {!isFactoryUser && order.payment_method === 'bank_transfer' && order.customer_note?.includes('[계좌이체 정보]') && (() => {
            try {
              const match = order.customer_note!.match(/\[계좌이체 정보\]\s*({.*})/);
              if (!match) return null;
              const info = JSON.parse(match[1]);
              if (!info.invoice_requested) return null;
              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                    <h3 className="text-sm font-semibold text-amber-900">계산서 발행 요청</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {info.invoice_email && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">수신 이메일</span>
                        <a href={`mailto:${info.invoice_email}`} className="text-blue-600 hover:underline font-medium">{info.invoice_email}</a>
                      </div>
                    )}
                    {info.biz_registration_url && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">사업자등록증</span>
                        <a href={info.biz_registration_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">파일 보기</a>
                      </div>
                    )}
                  </div>
                </div>
              );
            } catch {
              return null;
            }
          })()}

          {/* Payment Link - shown when payment_link_token exists */}
          {!isFactoryUser && order.payment_link_token && (
            <PaymentLinkCard token={order.payment_link_token} />
          )}

          {/* Price Adjustment - shown for admin users */}
          {!isFactoryUser && (
            <PriceAdjustmentCard
              order={order}
              onUpdate={() => {
                onUpdate();
              }}
              onOrderUpdate={onOrderUpdate}
            />
          )}

          {/* Factory Order Info - shown only for factory users */}
          {isFactoryUser && (
            <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <FactoryIcon className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">주문 정보</h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500">주문 구분</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.order_category === 'cobuy' ? '공동구매' : '일반'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">공장 배정 상태</p>
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
                    className={`w-full px-3 py-2 rounded-md text-sm font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 ${factoryStatusColor(order.factory_status)}`}
                  >
                    <option value="assigned">배정완료</option>
                    <option value="in_progress">작업중</option>
                    <option value="completed">작업완료</option>
                    <option value="shipped">출고완료</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500">마감일</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.deadline ? formatDate(order.deadline) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">금액</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.factory_amount ? `${order.factory_amount.toLocaleString()}원` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">결제 예정일</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.factory_payment_date ? formatDate(order.factory_payment_date) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">결제 상태</p>
                  <p className="text-sm font-medium text-gray-900">
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

// --- Sub-components ---

function PaymentLinkCard({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const paymentUrl = `https://modoouniform.com/order/custom/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paymentUrl);
    } catch {
      const input = document.createElement('input');
      input.value = paymentUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-blue-200 rounded-md shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-100 bg-blue-50/50">
        <Link2 className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-blue-900">고객 결제 링크</h3>
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-2">아래 링크를 고객에게 공유하면 결제할 수 있습니다.</p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={paymentUrl}
            className="flex-1 p-2 text-xs border border-gray-200 rounded bg-gray-50 text-gray-600 truncate"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1 text-xs whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      </div>
    </div>
  );
}

type AdjustMode = 'set_total' | 'discount_fixed' | 'discount_rate' | 'surcharge';

function PriceAdjustmentCard({
  order,
  onUpdate,
  onOrderUpdate,
}: {
  order: Order;
  onUpdate: () => void;
  onOrderUpdate: (order: Order) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState<AdjustMode>('set_total');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseAmount = order.original_amount ?? order.total_amount;

  const preview = useMemo(() => {
    const v = parseFloat(value) || 0;
    if (v <= 0) return null;
    switch (mode) {
      case 'set_total':
        return v;
      case 'discount_fixed':
        return Math.max(0, baseAmount - v);
      case 'discount_rate':
        return Math.max(0, baseAmount - Math.floor(baseAmount * (v / 100)));
      case 'surcharge':
        return baseAmount + v;
      default:
        return null;
    }
  }, [mode, value, baseAmount]);

  const handleSave = async () => {
    const v = parseFloat(value);
    if (!v || v <= 0) {
      setError('금액을 입력해주세요.');
      return;
    }
    if (mode === 'discount_rate' && v > 100) {
      setError('할인율은 100% 이하여야 합니다.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          priceAdjustment: { mode, value: v, note: note.trim() || undefined },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '금액 변경에 실패했습니다.');
        return;
      }

      onOrderUpdate(data.data as Order);
      onUpdate();
      setIsEditing(false);
      setValue('');
      setNote('');
    } catch {
      setError('금액 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">금액 관리</h3>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Pencil className="w-3 h-3" />
            금액 변경
          </button>
        )}
      </div>
      <div className="p-4">
        {/* Current amount summary */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">현재 결제 금액</span>
            <span className="font-bold text-gray-900">{order.total_amount.toLocaleString()}원</span>
          </div>
          {order.original_amount != null && order.original_amount !== order.total_amount && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>원래 금액</span>
              <span className="line-through">{order.original_amount.toLocaleString()}원</span>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="pt-3 border-t border-gray-100 space-y-3">
            {/* Mode selection */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'set_total' as const, label: '금액 지정' },
                { key: 'discount_fixed' as const, label: '금액 할인' },
                { key: 'discount_rate' as const, label: '할인율(%)' },
                { key: 'surcharge' as const, label: '금액 추가' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setMode(opt.key); setValue(''); setError(null); }}
                  className={`px-3 py-2 text-xs rounded-md border font-medium transition-colors ${
                    mode === opt.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Value input */}
            <div className="relative">
              <input
                type="number"
                min="0"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null); }}
                placeholder={
                  mode === 'set_total' ? '최종 결제 금액'
                  : mode === 'discount_fixed' ? '할인할 금액'
                  : mode === 'discount_rate' ? '할인 비율'
                  : '추가할 금액'
                }
                className="w-full p-2.5 pr-10 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {mode === 'discount_rate' ? '%' : '원'}
              </span>
            </div>

            {/* Preview */}
            {preview !== null && (
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded-md">
                <span className="text-xs text-blue-700">변경 후 결제 금액</span>
                <span className="text-sm font-bold text-blue-800">{preview.toLocaleString()}원</span>
              </div>
            )}

            {/* Note */}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="변경 사유 (선택)"
              className="w-full p-2.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setIsEditing(false); setValue(''); setNote(''); setError(null); }}
                className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
              >
                <X className="w-3 h-3" />
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !value}
                className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                적용
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
