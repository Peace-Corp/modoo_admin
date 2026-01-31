'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Factory, Order } from '@/types/types';
import { useAuthStore } from '@/store/useAuthStore';
import OrderDetail from '@/components/OrderDetail';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loadingFactories, setLoadingFactories] = useState(false);

  const initialFetchDone = useRef(false);
  const isFactoryUser = user?.role === 'factory';

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (user?.role === 'factory' && user.manufacturer_id) {
        params.set('factoryId', user.manufacturer_id);
      }
      const url = `/api/admin/orders${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'Failed to load order data.');
      }

      const payload = await response.json();
      const orders: Order[] = payload?.data || [];
      const foundOrder = orders.find((o) => o.id === orderId);

      if (!foundOrder) {
        throw new Error('Order not found.');
      }

      setOrder(foundOrder);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order data.');
    } finally {
      setLoading(false);
    }
  }, [orderId, user?.role, user?.manufacturer_id]);

  const fetchFactories = useCallback(async () => {
    setLoadingFactories(true);
    try {
      const response = await fetch('/api/admin/factories');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to load factories.');
      }
      const payload = await response.json();
      setFactories(payload?.data || []);
    } catch (err) {
      console.error('Error fetching factories:', err);
      setFactories([]);
    } finally {
      setLoadingFactories(false);
    }
  }, []);

  useEffect(() => {
    if (!user || initialFetchDone.current) return;
    initialFetchDone.current = true;

    const loadData = async () => {
      if (user.role === 'admin') {
        await Promise.all([fetchOrder(), fetchFactories()]);
      } else if (user.role === 'factory') {
        await fetchOrder();
        if (user.manufacturer_id) {
          setFactories([
            {
              id: user.manufacturer_id,
              name: user.manufacturer_name || user.email || 'Factory',
              email: user.email || null,
              phone_number: user.phone || null,
              is_active: true,
              created_at: user.created_at || new Date().toISOString(),
              updated_at: user.created_at || new Date().toISOString(),
            },
          ]);
        }
      } else {
        await fetchOrder();
      }
    };

    loadData();
  }, [user, fetchOrder, fetchFactories]);

  const handleBack = useCallback(() => {
    router.push('/orders');
  }, [router]);

  const handleUpdate = useCallback(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleOrderUpdate = useCallback((updatedOrder: Order) => {
    setOrder(updatedOrder);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || 'Order not found.'}</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <OrderDetail
      order={order}
      onBack={handleBack}
      onUpdate={handleUpdate}
      onOrderUpdate={handleOrderUpdate}
      factories={factories}
      canAssign={user?.role === 'admin'}
      loadingFactories={loadingFactories}
      isFactoryUser={isFactoryUser}
    />
  );
}
