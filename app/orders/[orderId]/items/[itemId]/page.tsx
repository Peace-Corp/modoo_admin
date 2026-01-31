'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrderItem } from '@/types/types';
import { useAuthStore } from '@/store/useAuthStore';
import OrderItemCanvas from '@/components/OrderItemCanvas';

export default function OrderItemPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const orderId = params.orderId as string;
  const itemId = params.itemId as string;

  const [orderItem, setOrderItem] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialFetchDone = useRef(false);

  const fetchOrderItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/items?orderId=${orderId}`);

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'Failed to load order items.');
      }

      const payload = await response.json();
      const items: OrderItem[] = payload?.data || [];
      const foundItem = items.find((item) => item.id === itemId);

      if (!foundItem) {
        throw new Error('Order item not found.');
      }

      setOrderItem(foundItem);
    } catch (err) {
      console.error('Error fetching order item:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order item.');
    } finally {
      setLoading(false);
    }
  }, [orderId, itemId]);

  useEffect(() => {
    if (!user || initialFetchDone.current) return;
    initialFetchDone.current = true;
    fetchOrderItem();
  }, [user, fetchOrderItem]);

  const handleBack = useCallback(() => {
    router.push(`/orders/${orderId}`);
  }, [router, orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !orderItem) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || 'Order item not found.'}</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to Order
        </button>
      </div>
    );
  }

  return <OrderItemCanvas orderItem={orderItem} onBack={handleBack} />;
}
