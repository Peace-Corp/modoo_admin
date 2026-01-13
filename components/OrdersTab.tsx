'use client';

import { useMemo, useState, useEffect } from 'react';
import { CoBuyParticipant, Factory, Order, OrderItem } from '@/types/types';
import { Package, Calendar, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import OrderDetail from './OrderDetail';

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

type CobuyParticipantsEntry = {
  sessionId: string | null;
  participants: CoBuyParticipantSummary[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
};

export default function OrdersTab() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [cobuyParticipants, setCobuyParticipants] = useState<Record<string, CobuyParticipantsEntry>>({});
  const [orderItemCounts, setOrderItemCounts] = useState<Record<string, number>>({});

  const isFactoryUser = user?.role === 'factory';

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [filterStatus, user]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchFactories();
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'factory') {
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
      } else {
        setFactories([]);
      }
    }
  }, [user?.role, user?.manufacturer_id, user?.manufacturer_name, user?.email, user?.phone]);

  useEffect(() => {
    setCobuyParticipants((prev) => {
      const next: Record<string, CobuyParticipantsEntry> = {};
      orders.forEach((order) => {
        const entry = prev[order.id];
        if (entry) {
          next[order.id] = entry;
        }
      });
      return next;
    });
  }, [orders]);

  const fetchOrders = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let url = `/api/admin/orders?status=${filterStatus}`;
      if (user?.role === 'factory' && user.manufacturer_id) {
        url += `&factoryId=${user.manufacturer_id}`;
      }
      const response = await fetch(url, {
        method: 'GET',
      });

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
  };

  const fetchFactories = async () => {
    setLoadingFactories(true);
    try {
      const response = await fetch('/api/admin/factories', { method: 'GET' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 목록을 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setFactories(payload?.data || []);
    } catch (error) {
      console.error('Error fetching factories:', error);
      setFactories([]);
    } finally {
      setLoadingFactories(false);
    }
  };

  const fetchCobuyParticipants = async (orderId: string) => {
    const existing = cobuyParticipants[orderId];
    if (existing?.loading) return;
    if (existing?.fetched) return;

    setCobuyParticipants((prev) => ({
      ...prev,
      [orderId]: {
        sessionId: prev[orderId]?.sessionId ?? null,
        participants: prev[orderId]?.participants ?? [],
        loading: true,
        error: null,
        fetched: prev[orderId]?.fetched ?? false,
      },
    }));

    try {
      const response = await fetch(`/api/admin/orders/cobuy-participants?orderId=${orderId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공동구매 참여자 정보를 불러오지 못했습니다.');
      }

      const payload = await response.json();
      const data = payload?.data as { sessionId: string | null; participants: CoBuyParticipantSummary[] } | undefined;

      setCobuyParticipants((prev) => ({
        ...prev,
        [orderId]: {
          sessionId: data?.sessionId ?? null,
          participants: data?.participants || [],
          loading: false,
          error: null,
          fetched: true,
        },
      }));
    } catch (error) {
      console.error('Error fetching cobuy participants:', error);
      setCobuyParticipants((prev) => ({
        ...prev,
        [orderId]: {
          sessionId: prev[orderId]?.sessionId ?? null,
          participants: prev[orderId]?.participants ?? [],
          loading: false,
          error: error instanceof Error ? error.message : '공동구매 참여자 정보를 불러오지 못했습니다.',
          fetched: false,
        },
      }));
    }
  };

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

  // Fetch order item counts for factory users
  useEffect(() => {
    if (isFactoryUser && orders.length > 0) {
      fetchOrderItemCounts();
    }
  }, [orders, isFactoryUser]);

  const fetchOrderItemCounts = async () => {
    const counts: Record<string, number> = {};
    for (const order of orders) {
      try {
        const response = await fetch(`/api/admin/orders/items?orderId=${order.id}`);
        if (response.ok) {
          const payload = await response.json();
          const items: OrderItem[] = payload?.data || [];
          counts[order.id] = items.reduce((sum, item) => sum + item.quantity, 0);
        }
      } catch (error) {
        console.error(`Error fetching items for order ${order.id}:`, error);
      }
    }
    setOrderItemCounts(counts);
  };

  const factoryMap = useMemo(() => {
    const map = new Map<string, Factory>();
    factories.forEach((factory) => map.set(factory.id, factory));
    return map;
  }, [factories]);

  const getFactoryLabel = (manufacturerId: string | null | undefined) => {
    if (!manufacturerId) return '미배정';
    const factory = factoryMap.get(manufacturerId);
    return factory?.name || factory?.email || manufacturerId;
  };

  const handleOrderUpdate = (updatedOrder: Order) => {
    setSelectedOrder(updatedOrder);
    setOrders((prev) =>
      prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (selectedOrder) {
    return (
      <OrderDetail
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
        onUpdate={fetchOrders}
        onOrderUpdate={handleOrderUpdate}
        factories={factories}
        canAssign={user?.role === 'admin'}
        loadingFactories={loadingFactories}
        isFactoryUser={isFactoryUser}
      />
    );
  }

  const cobuyPaymentStatusLabel: Record<CoBuyParticipant['payment_status'], string> = {
    pending: '대기',
    completed: '완료',
    failed: '실패',
    refunded: '환불',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">주문 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {orders.length}개의 주문</p>
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
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
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
                        <span className="text-sm text-gray-900">
                          {orderItemCounts[order.id] ?? '-'}
                        </span>
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

        {orders.length === 0 && (
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
