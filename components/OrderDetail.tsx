'use client';

import { useMemo, useState, useEffect } from 'react';
import type { CoBuyParticipant, Factory, Order, OrderItem } from '@/types/types';
import { ChevronLeft, MapPin, CreditCard, Package, Factory as FactoryIcon, Download } from 'lucide-react';
import OrderItemCanvas from './OrderItemCanvas';

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
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>(order.assigned_factory_id || '');
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
    setSelectedFactoryId(order.assigned_factory_id || '');
  }, [order.assigned_factory_id]);

  // Sync factory fields when order changes
  useEffect(() => {
    setDeadline(order.deadline ? order.deadline.split('T')[0] : '');
    setFactoryAmount(order.factory_amount?.toString() || '');
    setFactoryPaymentDate(order.factory_payment_date ? order.factory_payment_date.split('T')[0] : '');
    setFactoryPaymentStatus(order.factory_payment_status || 'pending');
  }, [order.deadline, order.factory_amount, order.factory_payment_date, order.factory_payment_status]);

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
    (sum, item) => sum + item.price_per_item * item.quantity,
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

  const currentFactoryLabel = order.assigned_factory_id
    ? factoryMap.get(order.assigned_factory_id)?.name ||
      factoryMap.get(order.assigned_factory_id)?.email ||
      order.assigned_factory_id
    : '미배정';

  const handleAssignFactory = async () => {
    if (!canAssign) return;

    setAssigning(true);
    setAssignError(null);
    try {
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

  if (selectedItem) {
    return (
      <OrderItemCanvas
        orderItem={selectedItem}
        onBack={() => setSelectedItem(null)}
      />
    );
  }

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

        
      </div>

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
                    onClick={() => setSelectedItem(item)}
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
                            {(item.price_per_item * item.quantity).toLocaleString()}원
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


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
                    {order.delivery_fee.toLocaleString()}원
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-base font-semibold text-gray-900">총 금액</span>
                  <span className="text-base font-bold text-blue-600">
                    {order.total_amount.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Factory Assignment */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FactoryIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-900">공장 배정</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-sm text-gray-500">현재 배정</p>
                <p className="font-medium text-gray-900">{currentFactoryLabel}</p>
              </div>

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

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">결제 상태</label>
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
          </div>

        </div>

        {/* Right Column - Customer & Shipping Info (hidden for factory users) */}
        <div className="space-y-4">
          {/* Customer Information - hidden for factory users */}
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
            </div>
          )}

          {/* Shipping Information - hidden for factory users */}
          {!isFactoryUser && order.shipping_method !== 'pickup' && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-gray-600" />
                <h3 className="text-base font-semibold text-gray-900">배송 정보</h3>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {order.shipping_method === 'domestic' ? '국내 배송' : '해외 배송'}
                </p>
                {order.shipping_method === 'international' && order.country_code && (
                  <p className="text-sm font-medium text-gray-900">{order.country_code}</p>
                )}
                {order.postal_code && (
                  <p className="text-sm text-gray-900">[{order.postal_code}]</p>
                )}
                {order.state && order.city && (
                  <p className="text-sm text-gray-900">
                    {order.state} {order.city}
                  </p>
                )}
                {order.address_line_1 && (
                  <p className="text-sm text-gray-900">{order.address_line_1}</p>
                )}
                {order.address_line_2 && (
                  <p className="text-sm text-gray-900">{order.address_line_2}</p>
                )}
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
                  <p className="text-sm text-gray-500">주문 상태</p>
                  <p className="font-medium text-gray-900">
                    {order.order_status === 'pending' ? '대기중' :
                     order.order_status === 'processing' ? '처리중' :
                     order.order_status === 'completed' ? '완료' :
                     order.order_status === 'cancelled' ? '취소' :
                     order.order_status === 'refunded' ? '환불' : order.order_status}
                  </p>
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
    </div>
  );
}
