'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Factory, Order } from '@/types/types';
import { Package, Calendar, Clock, Plus, Factory as FactoryIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import AdminOrderCreator from '@/components/orders/AdminOrderCreator';
import FactoryAllocationModal from '@/components/orders/FactoryAllocationModal';

// Extended order type with item count from API
type OrderWithItemCount = Order & {
  order_items?: { count: number }[];
};

export default function OrdersTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  // Detect return from editor: /orders?resumeProductId=xxx&designId=yyy
  const resumeProductId = searchParams.get('resumeProductId');
  const resumeDesignId = searchParams.get('designId');

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showOrderCreator, setShowOrderCreator] = useState(!!resumeProductId && !!resumeDesignId);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allocationOrder, setAllocationOrder] = useState<OrderWithItemCount | null>(null);

  const isFactoryUser = user?.role === 'factory';

  // Build orders SWR key based on user role and filter
  const ordersKey = useMemo(() => {
    if (!user) return null;
    const params = new URLSearchParams();
    if (user.role === 'factory' && user.manufacturer_id) {
      params.set('factoryId', user.manufacturer_id);
    }
    if (filterStatus !== 'all') {
      params.set('status', filterStatus);
    }
    return `/api/admin/orders${params.toString() ? `?${params}` : ''}`;
  }, [user, filterStatus]);

  const { data: orders = [], isLoading: loading, mutate: mutateOrders } = useSWR<OrderWithItemCount[]>(ordersKey);

  // Factories: fetch for admin, compute from profile for factory user
  const { data: fetchedFactories = [] } = useSWR<Factory[]>(
    user?.role === 'admin' ? '/api/admin/factories' : null
  );

  const factories = useMemo(() => {
    if (user?.role === 'admin') return fetchedFactories;
    if (user?.role === 'factory' && user.manufacturer_id) {
      return [{
        id: user.manufacturer_id,
        name: user.manufacturer_name || user.email || '공장',
        email: user.email || null,
        phone_number: user.phone || null,
        is_active: true,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.created_at || new Date().toISOString(),
      }];
    }
    return [];
  }, [user, fetchedFactories]);

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

  const handleStatusChange = useCallback(async (orderId: string, newStatus: Order['order_status']) => {
    setUpdatingStatusId(orderId);
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, orderStatus: newStatus }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '주문 상태 변경에 실패했습니다.');
      }
      mutateOrders(
        orders.map((o) => (o.id === orderId ? { ...o, order_status: newStatus } : o)),
        { revalidate: false }
      );
    } catch (error) {
      console.error('Error updating order status:', error);
      setErrorMessage(error instanceof Error ? error.message : '주문 상태 변경에 실패했습니다.');
    } finally {
      setUpdatingStatusId(null);
    }
  }, [orders, mutateOrders]);

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
          <h2 className="text-base sm:text-xl font-semibold text-gray-900">주문 관리</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">총 {filteredOrders.length}개의 주문</p>
        </div>
        {!isFactoryUser && (
          <button
            onClick={() => setShowOrderCreator(true)}
            className="flex items-center gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">주문 생성</span>
            <span className="sm:hidden">생성</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200/60 rounded-md p-2 sm:p-3 shadow-sm">
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
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
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
          <div className="px-4 py-3 text-xs sm:text-sm text-red-700 bg-red-50 border-b border-red-100">
            {errorMessage}
          </div>
        )}
        <div className="overflow-x-auto hidden md:block">
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
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
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.order_status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as Order['order_status'])}
                          disabled={updatingStatusId === order.id}
                          className={`px-2 py-1 rounded-md text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 ${getStatusColor(order.order_status)}`}
                        >
                          <option value="pending">대기중</option>
                          <option value="processing">처리중</option>
                          <option value="completed">완료</option>
                          <option value="cancelled">취소</option>
                          <option value="refunded">환불</option>
                        </select>
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
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setAllocationOrder(order)}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        >
                          <FactoryIcon className="w-3 h-3" />
                          공장배정
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-gray-200">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => handleOrderClick(order.id)}
              className="p-3 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              {isFactoryUser ? (
                /* Factory user mobile card */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-mono text-blue-600 truncate">{order.id}</div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${getStatusColor(order.order_status)}`}>
                      {order.order_status === 'pending' ? '대기중' : order.order_status === 'processing' ? '처리중' : order.order_status === 'completed' ? '완료' : order.order_status === 'cancelled' ? '취소' : order.order_status === 'refunded' ? '환불' : order.order_status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                    <span>{order.order_category === 'cobuy' ? '공동구매' : '일반'}</span>
                    <span>수량: {getOrderItemCount(order)}</span>
                    <span className="font-medium text-gray-700">{order.factory_amount ? `${order.factory_amount.toLocaleString()}원` : '-'}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />마감: {formatDateShort(order.deadline)}</span>
                    <span>결제: {formatDateShort(order.factory_payment_date)}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getFactoryPaymentStatusColor(order.factory_payment_status)}`}>
                      {getFactoryPaymentStatusLabel(order.factory_payment_status)}
                    </span>
                  </div>
                </>
              ) : (
                /* Admin mobile card */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{order.customer_name}</div>
                      <div className="text-[11px] text-gray-400 truncate">{order.customer_email}</div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <select
                        value={order.order_status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                        disabled={updatingStatusId === order.id}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer disabled:opacity-60 ${getStatusColor(order.order_status)}`}
                      >
                        <option value="pending">대기중</option>
                        <option value="processing">처리중</option>
                        <option value="completed">완료</option>
                        <option value="cancelled">취소</option>
                        <option value="refunded">환불</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                    <span>{order.order_category === 'cobuy' ? '공동구매' : '일반'}</span>
                    <span className="font-medium text-gray-700">{order.total_amount.toLocaleString()}원</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getPaymentStatusColor(order.payment_status)}`}>{order.payment_status}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(order.created_at)}</span>
                      <span className={getFactoryLabel(order.assigned_manufacturer_id) === '미배정' ? 'text-red-500' : ''}>{getFactoryLabel(order.assigned_manufacturer_id)}</span>
                      <span>{order.shipping_method === 'domestic' ? '국내배송' : order.shipping_method === 'international' ? '해외배송' : '픽업'}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAllocationOrder(order); }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors shrink-0"
                    >
                      <FactoryIcon className="w-3 h-3" />
                      공장배정
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2">주문이 없습니다</h3>
            <p className="text-xs sm:text-sm text-gray-500">새로운 주문이 들어오면 여기에 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* Order Creator Modal */}
      {showOrderCreator && (
        <AdminOrderCreator
          onClose={() => {
            setShowOrderCreator(false);
            if (resumeProductId || resumeDesignId) {
              router.replace('/orders');
            }
          }}
          onSuccess={() => {
            setShowOrderCreator(false);
            if (resumeProductId || resumeDesignId) {
              router.replace('/orders');
            }
            mutateOrders();
          }}
          initialProductId={resumeProductId ?? undefined}
          initialDesignId={resumeDesignId ?? undefined}
        />
      )}

      {/* Factory Allocation Modal */}
      {allocationOrder && (
        <FactoryAllocationModal
          order={allocationOrder}
          factories={factories}
          onClose={() => setAllocationOrder(null)}
          onSuccess={() => {
            setAllocationOrder(null);
            mutateOrders();
          }}
        />
      )}
    </div>
  );
}
