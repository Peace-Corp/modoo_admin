'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Factory, Order } from '@/types/types';
import { Package, Calendar, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

// Extended order type with item count from API
type OrderWithItemCount = Order & {
  order_items?: { count: number }[];
};

export default function OrdersTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<OrderWithItemCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);

  // Track if initial data has been fetched to avoid duplicate fetches
  const initialFetchDone = useRef(false);

  const isFactoryUser = user?.role === 'factory';

  const fetchOrders = useCallback(async (status: string = 'all') => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (user?.role === 'factory' && user.manufacturer_id) {
        params.set('factoryId', user.manufacturer_id);
      }
      if (status !== 'all') {
        params.set('status', status);
      }
      const url = `/api/admin/orders${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '주문 데이터를 불러오지 못했습니다.');
      }

      const payload = await response.json();
      setOrders(payload?.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
      setErrorMessage(error instanceof Error ? error.message : '주문 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.manufacturer_id]);

  const fetchFactories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/factories');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 목록을 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setFactories(payload?.data || []);
    } catch (error) {
      console.error('Error fetching factories:', error);
      setFactories([]);
    }
  }, []);

  // Initial data fetch - parallel loading of orders and factories
  useEffect(() => {
    if (!user || initialFetchDone.current) return;
    initialFetchDone.current = true;

    const loadData = async () => {
      if (user.role === 'admin') {
        // Admin: fetch orders and factories in parallel
        await Promise.all([fetchOrders(filterStatus), fetchFactories()]);
      } else if (user.role === 'factory') {
        // Factory user: fetch orders and set factory info from user profile
        await fetchOrders(filterStatus);
        if (user.manufacturer_id) {
          setFactories([
            {
              id: user.manufacturer_id,
              name: user.manufacturer_name || user.email || '공장',
              email: user.email || null,
              phone_number: user.phone || null,
              is_active: true,
              created_at: user.created_at || new Date().toISOString(),
              updated_at: user.created_at || new Date().toISOString(),
            },
          ]);
        }
      } else {
        await fetchOrders(filterStatus);
      }
    };

    loadData();
  }, [user, fetchOrders, fetchFactories, filterStatus]);

  // Re-fetch orders when filter changes (server-side filtering)
  useEffect(() => {
    if (!user || !initialFetchDone.current) return;
    fetchOrders(filterStatus);
  }, [filterStatus, user, fetchOrders]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFactoryPaymentStatusLabel = (status: string | null) => {
    if (!status) return '-';
    const labels: Record<string, string> = {
      pending: '대기',
      completed: '완료',
      cancelled: '취소',
    };
    return labels[status] || status;
  };

  const getFactoryPaymentStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const factoryMap = useMemo(() => {
    const map = new Map<string, Factory>();
    factories.forEach((factory) => map.set(factory.id, factory));
    return map;
  }, [factories]);

  // Orders are now filtered server-side, no client-side filtering needed
  const filteredOrders = orders;

  // Get order item count from the API response
  const getOrderItemCount = (order: OrderWithItemCount) => {
    const count = order.order_items?.[0]?.count;
    return count !== undefined ? count : '-';
  };

  const getFactoryLabel = (manufacturerId: string | null | undefined) => {
    if (!manufacturerId) return '미배정';
    const factory = factoryMap.get(manufacturerId);
    return factory?.name || factory?.email || manufacturerId;
  };

  const handleOrderClick = useCallback((orderId: string) => {
    router.push(`/orders/${orderId}`);
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">주문 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {filteredOrders.length}개의 주문</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200/60 rounded-md p-3 shadow-sm">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: '전체' },
            { value: 'pending', label: '대기중' },
            { value: 'processing', label: '처리중' },
            { value: 'completed', label: '완료' },
            { value: 'cancelled', label: '취소' },
            { value: 'refunded', label: '환불' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
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

      {/* Orders List */}
      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        {errorMessage && (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
            {errorMessage}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              {isFactoryUser ? (
                // Factory user table headers - limited info, no personal data
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문 ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제품 종류
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    구분
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    마감일
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    결제 예정일
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    결제 상태
                  </th>
                </tr>
              ) : (
                // Admin table headers - full info
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문 ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    고객 정보
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문 구분
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문 일시
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문 상태
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    결제 상태
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공장 배정
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    배송 방법
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => handleOrderClick(order.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {isFactoryUser ? (
                    // Factory user row - limited info, no personal data
                    <>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-mono text-blue-600">{order.id}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {order.order_category === 'cobuy' ? '공동구매' : '일반'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{getOrderItemCount(order)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            order.order_status
                          )}`}
                        >
                          {order.order_status === 'pending' ? '대기중' :
                           order.order_status === 'processing' ? '처리중' :
                           order.order_status === 'completed' ? '완료' :
                           order.order_status === 'cancelled' ? '취소' :
                           order.order_status === 'refunded' ? '환불' : order.order_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatDateShort(order.deadline)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {order.factory_amount ? `${order.factory_amount.toLocaleString()}원` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {formatDateShort(order.factory_payment_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFactoryPaymentStatusColor(
                            order.factory_payment_status
                          )}`}
                        >
                          {getFactoryPaymentStatusLabel(order.factory_payment_status)}
                        </span>
                      </td>
                    </>
                  ) : (
                    // Admin row - full info
                    <>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-mono text-blue-600">{order.id}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                        <div className="text-xs text-gray-500">{order.customer_email}</div>
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-xs'>
                        {order.order_category === 'cobuy' ? '공동구매' : '일반'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(order.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {order.total_amount.toLocaleString()}원
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            order.order_status
                          )}`}
                        >
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(
                            order.payment_status
                          )}`}
                        >
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm text-gray-900 ${getFactoryLabel(order.assigned_manufacturer_id) === '미배정' && 'text-red-500'}`}>
                          {getFactoryLabel(order.assigned_manufacturer_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {order.shipping_method === 'domestic'
                            ? '국내배송'
                            : order.shipping_method === 'international'
                            ? '해외배송'
                            : '픽업'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">주문이 없습니다</h3>
            <p className="text-gray-500">새로운 주문이 들어오면 여기에 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
