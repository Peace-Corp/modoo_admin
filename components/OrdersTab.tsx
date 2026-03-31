'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Factory, Order } from '@/types/types';
import { Package, Calendar, Clock, Plus, Factory as FactoryIcon, RotateCcw, Search, X } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import AdminOrderCreator from '@/components/orders/AdminOrderCreator';
import FactoryAllocationModal from '@/components/orders/FactoryAllocationModal';
import RefundModal from '@/components/orders/RefundModal';

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

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showOrderCreator, setShowOrderCreator] = useState(!!resumeProductId && !!resumeDesignId);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [allocationOrder, setAllocationOrder] = useState<OrderWithItemCount | null>(null);
  const [refundOrder, setRefundOrder] = useState<OrderWithItemCount | null>(null);

  const isFactoryUser = user?.role === 'factory';

  // Build orders SWR key — always fetch all, filter client-side
  const ordersKey = useMemo(() => {
    if (!user) return null;
    const params = new URLSearchParams();
    if (user.role === 'factory' && user.manufacturer_id) {
      params.set('factoryId', user.manufacturer_id);
    }
    return `/api/admin/orders${params.toString() ? `?${params}` : ''}`;
  }, [user]);

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
      payment_completed: 'bg-blue-100 text-blue-800',
      in_production: 'bg-yellow-100 text-yellow-800',
      shipping: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      partially_cancelled: 'bg-red-100 text-red-800',
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

  const getFactoryStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      shipped: 'bg-indigo-100 text-indigo-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getFactoryStatusLabel = (status: string | null) => {
    if (!status) return '-';
    const labels: Record<string, string> = {
      pending: '대기중',
      assigned: '배정완료',
      in_progress: '작업중',
      completed: '작업완료',
      shipped: '출고완료',
      cancelled: '취소',
    };
    return labels[status] || status;
  };

  const [updatingFactoryStatusId, setUpdatingFactoryStatusId] = useState<string | null>(null);

  const handleFactoryStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    setUpdatingFactoryStatusId(orderId);
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, factoryStatus: newStatus }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '상태 변경에 실패했습니다.');
      }
      const { data } = await response.json();
      mutateOrders(
        orders.map((o) => (o.id === orderId ? { ...o, factory_status: data.factory_status, order_status: data.order_status } : o)),
        { revalidate: false }
      );
    } catch (error) {
      console.error('Error updating factory status:', error);
      setErrorMessage(error instanceof Error ? error.message : '상태 변경에 실패했습니다.');
    } finally {
      setUpdatingFactoryStatusId(null);
    }
  }, [orders, mutateOrders]);

  const factoryMap = useMemo(() => {
    const map = new Map<string, Factory>();
    factories.forEach((factory) => map.set(factory.id, factory));
    return map;
  }, [factories]);

  const toggleStatus = useCallback((status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Status filter (multi-select)
    if (selectedStatuses.size > 0) {
      result = result.filter((o) =>
        isFactoryUser
          ? selectedStatuses.has(o.factory_status || 'pending')
          : selectedStatuses.has(o.order_status)
      );
    }

    // Text search (name, email, order ID)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, selectedStatuses, searchQuery, isFactoryUser]);

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

      {/* Search & Filters */}
      <div className="bg-white border border-gray-200/60 rounded-md p-2 sm:p-3 shadow-sm space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 이메일, 주문 ID 검색..."
            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(isFactoryUser ? [
            { value: 'assigned', label: '배정완료' },
            { value: 'in_progress', label: '작업중' },
            { value: 'completed', label: '작업완료' },
            { value: 'shipped', label: '출고완료' },
          ] : [
            { value: 'payment_completed', label: '결제완료' },
            { value: 'in_production', label: '제작중' },
            { value: 'shipping', label: '배송중' },
            { value: 'delivered', label: '배송완료' },
            { value: 'cancelled', label: '취소' },
          ]).map((filter) => (
            <button
              key={filter.value}
              onClick={() => toggleStatus(filter.value)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
                selectedStatuses.has(filter.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
          {selectedStatuses.size > 0 && (
            <button
              onClick={() => setSelectedStatuses(new Set())}
              className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              초기화
            </button>
          )}
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
                    주문 구분
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공장 배정 상태
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
                    주문 일시
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문 상태
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공장 배정
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    배정 상태
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
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.factory_status || 'assigned'}
                          onChange={(e) => handleFactoryStatusChange(order.id, e.target.value)}
                          disabled={updatingFactoryStatusId === order.id || order.factory_status === 'shipped'}
                          className={`px-2 py-1 rounded-md text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 ${getFactoryStatusColor(order.factory_status)}`}
                        >
                          <option value="assigned">배정완료</option>
                          <option value="in_progress">작업중</option>
                          <option value="completed">작업완료</option>
                          <option value="shipped">출고완료</option>
                        </select>
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-600">
                          {new Date(order.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
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
                          <option value="payment_completed">결제완료</option>
                          <option value="in_production">제작중</option>
                          <option value="shipping">배송중</option>
                          <option value="delivered">배송완료</option>
                          <option value="cancelled">취소</option>
                          <option value="partially_cancelled">부분취소</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm text-gray-900 ${getFactoryLabel(order.assigned_manufacturer_id) === '미배정' && 'text-red-500'}`}>
                          {getFactoryLabel(order.assigned_manufacturer_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {order.assigned_manufacturer_id ? (
                          <select
                            value={order.factory_status || 'pending'}
                            onChange={(e) => handleFactoryStatusChange(order.id, e.target.value)}
                            disabled={updatingFactoryStatusId === order.id}
                            className={`px-2 py-1 rounded-md text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 ${getFactoryStatusColor(order.factory_status)}`}
                          >
                            <option value="pending">대기중</option>
                            <option value="assigned">배정완료</option>
                            <option value="in_progress">작업중</option>
                            <option value="completed">작업완료</option>
                            <option value="shipped">출고완료</option>
                            <option value="cancelled">취소</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setAllocationOrder(order)}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                          >
                            <FactoryIcon className="w-3 h-3" />
                            공장배정
                          </button>
                          {order.payment_status === 'completed' && (
                            <button
                              onClick={() => setRefundOrder(order)}
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                              환불
                            </button>
                          )}
                        </div>
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
                    <div onClick={(e) => e.stopPropagation()}>
                      <select
                        value={order.factory_status || 'assigned'}
                        onChange={(e) => handleFactoryStatusChange(order.id, e.target.value)}
                        disabled={updatingFactoryStatusId === order.id || order.factory_status === 'shipped'}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer disabled:opacity-60 ${getFactoryStatusColor(order.factory_status)}`}
                      >
                        <option value="assigned">배정완료</option>
                        <option value="in_progress">작업중</option>
                        <option value="completed">작업완료</option>
                        <option value="shipped">출고완료</option>
                      </select>
                    </div>
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
                        <option value="payment_completed">결제완료</option>
                        <option value="in_production">제작중</option>
                        <option value="shipping">배송중</option>
                        <option value="delivered">배송완료</option>
                        <option value="cancelled">취소</option>
                        <option value="partially_cancelled">부분취소</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                    <span>{order.order_category === 'cobuy' ? '공동구매' : '일반'}</span>
                    <span className="font-medium text-gray-700">{order.total_amount.toLocaleString()}원</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getPaymentStatusColor(order.payment_status)}`}>{order.payment_status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(order.created_at)}</span>
                    <span className={getFactoryLabel(order.assigned_manufacturer_id) === '미배정' ? 'text-red-500' : ''}>{getFactoryLabel(order.assigned_manufacturer_id)}</span>
                    {order.assigned_manufacturer_id && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.factory_status || 'pending'}
                          onChange={(e) => handleFactoryStatusChange(order.id, e.target.value)}
                          disabled={updatingFactoryStatusId === order.id}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer disabled:opacity-60 ${getFactoryStatusColor(order.factory_status)}`}
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
                    <span>{order.shipping_method === 'domestic' ? '국내배송' : order.shipping_method === 'international' ? '해외배송' : '픽업'}{order.shipping_method !== 'pickup' && order.address_line_1 ? ` · ${order.address_line_1}` : ''}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex-1" />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setAllocationOrder(order); }}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                      >
                        <FactoryIcon className="w-3 h-3" />
                        공장배정
                      </button>
                      {order.payment_status === 'completed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRefundOrder(order); }}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          환불
                        </button>
                      )}
                    </div>
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

      {/* Refund Modal */}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSuccess={() => {
            setRefundOrder(null);
            mutateOrders();
          }}
        />
      )}
    </div>
  );
}
