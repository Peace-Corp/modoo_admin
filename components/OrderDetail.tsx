'use client';

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { Factory, Order, OrderItem } from '@/types/types';
import { ChevronLeft, MapPin, CreditCard, Package, Factory as FactoryIcon } from 'lucide-react';
import OrderItemCanvas from './OrderItemCanvas';

interface OrderDetailProps {
  order: Order;
  onBack: () => void;
  onUpdate: () => void;
  onOrderUpdate: (order: Order) => void;
  factories: Factory[];
  canAssign: boolean;
  loadingFactories: boolean;
}

export default function OrderDetail({
  order,
  onBack,
  onUpdate,
  onOrderUpdate,
  factories,
  canAssign,
  loadingFactories,
}: OrderDetailProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>(order.assigned_factory_id || '');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderItems();
  }, [order.id]);

  useEffect(() => {
    setSelectedFactoryId(order.assigned_factory_id || '');
  }, [order.assigned_factory_id]);

  const fetchOrderItems = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (error) throw error;

      setOrderItems(data || []);
    } catch (error) {
      console.error('Error fetching order items:', error);
    } finally {
      setLoading(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">주문 상세</h2>
          <p className="text-gray-500 mt-1">주문 ID: {order.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">주문 상품</h3>
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
                    className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
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
                      {item.item_options && (
                        <div className="text-sm  mt-1">
                          {(item.item_options.color_name || item.item_options.variants?.[0]?.color_name) && (
                            <span>
                              색상: {item.item_options.color_name || item.item_options.variants?.[0]?.color_name}
                            </span>
                          )}
                          {(item.item_options.size_name || item.item_options.variants?.[0]?.size_name) && (
                            <span className="ml-3">
                              사이즈: {item.item_options.size_name || item.item_options.variants?.[0]?.size_name}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">수량: {item.quantity}</span>
                        <span className="font-semibold text-gray-900">
                          {(item.price_per_item * item.quantity).toLocaleString()}원
                        </span>
                      </div>
                      {item.canvas_state && Object.keys(item.canvas_state).length > 0 && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            커스텀 디자인 포함
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">주문 요약</h3>
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
                <span className="text-lg font-semibold text-gray-900">총 금액</span>
                <span className="text-lg font-bold text-blue-600">
                  {order.total_amount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          {/* Factory Assignment */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FactoryIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">공장 배정</h3>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                    >
                      <option value="">미배정</option>
                      {factories.map((factory) => (
                        <option key={factory.id} value={factory.id}>
                          {factory.name || factory.email || factory.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAssignFactory}
                    disabled={assigning || loadingFactories}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {assigning ? '배정 중...' : '배정 저장'}
                  </button>
                </>
              )}

              {assignError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {assignError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Customer & Shipping Info */}
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">고객 정보</h3>
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

          {/* Shipping Information */}
          {order.shipping_method !== 'pickup' && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">배송 정보</h3>
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

          {/* Payment Information */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">결제 정보</h3>
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

          
        </div>
      </div>
    </div>
  );
}
