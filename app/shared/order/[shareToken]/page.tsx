'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Package, Calendar, Clock, CreditCard } from 'lucide-react';
import type { OrderItem, CanvasState, CustomFont } from '@/types/types';
import OrderItemCanvas from '@/components/OrderItemCanvas';

interface PublicOrder {
  id: string;
  order_status: string;
  order_category: string | null;
  shipping_method: string;
  country_code: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  deadline: string | null;
  factory_amount: number | null;
  factory_payment_date: string | null;
  factory_payment_status: 'pending' | 'completed' | 'cancelled' | null;
  created_at: string;
}

interface PublicOrderItem {
  id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  canvas_state: Record<string, CanvasState>;
  color_selections: Record<string, unknown>;
  item_options: {
    size_id?: string;
    size_name?: string;
    color_id?: string;
    color_name?: string;
    color_hex?: string;
    color_code?: string;
    variants?: Array<{
      size_id?: string;
      size_name?: string;
      color_id?: string;
      color_name?: string;
      color_hex?: string;
      color_code?: string;
      quantity?: number;
    }>;
  };
  thumbnail_url: string | null;
  image_urls?: Record<string, Array<{ url: string; path?: string; uploadedAt?: string }>> | string | null;
  text_svg_exports?: Record<string, unknown> | string | null;
  custom_fonts?: CustomFont[] | string | null;
  products?: { product_code: string | null } | null;
  created_at: string;
}

const orderStatusLabels: Record<string, string> = {
  pending: '대기중',
  processing: '처리중',
  completed: '완료',
  cancelled: '취소',
  refunded: '환불',
};

export default function SharedOrderPage() {
  const params = useParams();
  const shareToken = params?.shareToken as string;

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [items, setItems] = useState<PublicOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    fetchOrderData();
  }, [shareToken]);

  const fetchOrderData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/public/orders/${shareToken}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || '주문을 찾을 수 없습니다.');
      }

      const { data } = await response.json();
      setOrder(data.order);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '주문 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">주문을 찾을 수 없습니다</h1>
          <p className="text-gray-600">{error || '유효하지 않은 링크입니다.'}</p>
        </div>
      </div>
    );
  }

  // Show full-screen OrderItemCanvas when an item is selected
  if (selectedItem) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <OrderItemCanvas
            orderItem={selectedItem as unknown as OrderItem}
            onBack={() => setSelectedItemId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">주문 상세 정보</h1>
              <p className="text-sm text-gray-500">주문 ID: {order.id}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                order.order_status === 'completed' ? 'bg-green-100 text-green-800' :
                order.order_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                order.order_status === 'cancelled' || order.order_status === 'refunded' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {orderStatusLabels[order.order_status] || order.order_status}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Order Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">주문일</span>
                </div>
                <p className="font-medium text-gray-900">{formatDate(order.created_at)}</p>
              </div>
              {order.deadline && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">마감일</span>
                  </div>
                  <p className="font-medium text-gray-900">{formatDate(order.deadline)}</p>
                </div>
              )}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">주문 구분</span>
                </div>
                <p className="font-medium text-gray-900">
                  {order.order_category === 'cobuy' ? '공동구매' : '일반 주문'}
                </p>
              </div>
            </div>

            {/* Order Items List */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">주문 상품 ({items.length})</h2>
              <div className="space-y-3">
                {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className="flex gap-4 p-3 border border-gray-200 rounded-lg cursor-pointer transition-all hover:border-gray-300 hover:bg-gray-50"
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
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{item.product_title}</h3>
                        {item.products?.product_code && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            상품코드: {item.products.product_code}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span>수량: {item.quantity}</span>
                          {item.item_options?.color_name && (
                            <span className="flex items-center gap-1">
                              색상: {item.item_options.color_name}
                              {item.item_options.color_hex && (
                                <span
                                  className="w-4 h-4 rounded border border-gray-300"
                                  style={{ backgroundColor: item.item_options.color_hex }}
                                />
                              )}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          클릭하여 디자인 보기
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Right Column - Factory Info */}
          <div className="space-y-4">
            {/* Order Summary for Factory */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-base font-semibold text-gray-900 mb-3">주문 요약</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">총 상품 수</span>
                  <span className="font-medium text-gray-900">{items.length}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">총 수량</span>
                  <span className="font-medium text-gray-900">
                    {items.reduce((sum, item) => sum + item.quantity, 0)}개
                  </span>
                </div>
                {order.deadline && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600">마감일</span>
                    <span className="font-semibold text-red-600">{formatDate(order.deadline)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Factory Payment Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <h2 className="text-base font-semibold text-gray-900">결제 정보</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">금액</p>
                  <p className="font-medium text-gray-900">
                    {order.factory_amount ? `${order.factory_amount.toLocaleString()}원` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">결제 예정일</p>
                  <p className="font-medium text-gray-900">
                    {order.factory_payment_date ? formatDate(order.factory_payment_date) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">결제 상태</p>
                  <p className={`font-medium ${
                    order.factory_payment_status === 'completed' ? 'text-green-600' :
                    order.factory_payment_status === 'cancelled' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {order.factory_payment_status === 'pending' ? '대기' :
                     order.factory_payment_status === 'completed' ? '완료' :
                     order.factory_payment_status === 'cancelled' ? '취소' : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-sm text-gray-500 text-center">
            이 페이지는 공유 링크를 통해 접근하였습니다. 주문 정보는 읽기 전용입니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
