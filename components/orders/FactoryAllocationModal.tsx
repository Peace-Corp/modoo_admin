'use client';

import { useState, useEffect } from 'react';
import { Factory, Order, OrderItem } from '@/types/types';
import { X, Factory as FactoryIcon, Package } from 'lucide-react';
import { extractVariants } from '@/lib/orderUtils';

interface FactoryAllocationModalProps {
  order: Order;
  factories: Factory[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function FactoryAllocationModal({
  order,
  factories,
  onClose,
  onSuccess,
}: FactoryAllocationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [formData, setFormData] = useState({
    assigned_manufacturer_id: order.assigned_manufacturer_id || '',
    factory_amount: order.factory_amount || 0,
    deadline: order.deadline || '',
    factory_payment_date: order.factory_payment_date || '',
    factory_payment_status: order.factory_payment_status || 'pending',
  });

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`/api/admin/orders/items?orderId=${order.id}`);
        if (res.ok) {
          const payload = await res.json();
          setOrderItems(payload?.data || []);
        }
      } catch {
        // Non-critical — modal still works without items
      } finally {
        setLoadingItems(false);
      }
    };
    fetchItems();
  }, [order.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/orders/factory-allocation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          ...formData,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 배정에 실패했습니다.');
      }

      onSuccess();
    } catch (err) {
      console.error('Factory allocation error:', err);
      setError(err instanceof Error ? err.message : '공장 배정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FactoryIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">공장 배정</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Order Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">주문 ID</div>
                <div className="font-mono text-sm text-blue-600">{order.id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-1">고객명</div>
                <div className="text-sm font-medium">{order.customer_name}</div>
              </div>
            </div>

            {/* Order Items */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  주문 상품 ({loadingItems ? '...' : orderItems.length})
                </span>
              </div>
              {loadingItems ? (
                <div className="flex items-center justify-center py-3">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : orderItems.length === 0 ? (
                <p className="text-xs text-gray-400">상품 정보가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200">
                      <div className="w-10 h-10 bg-gray-100 rounded shrink-0 overflow-hidden">
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt={item.product_title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-900 truncate">{item.product_title}</div>
                        {item.design_title && (
                          <div className="text-[11px] text-gray-500 truncate">{item.design_title}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        {(() => {
                          const variants = extractVariants(item);
                          if (variants.length > 1) {
                            return (
                              <>
                                {variants.filter(v => (v.quantity ?? 0) > 0).map((v, vi) => (
                                  <span key={vi} className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">
                                    {v.size_name && <span>{v.size_name}</span>}
                                    <span className="font-medium">x{v.quantity}</span>
                                  </span>
                                ))}
                                <span className="text-[10px] font-semibold text-blue-600">({item.quantity})</span>
                              </>
                            );
                          }
                          const v = variants[0];
                          return <span className="text-xs text-gray-500">{v?.size_name ? `${v.size_name} ` : ''}x{item.quantity}</span>;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Factory Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공장 선택 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.assigned_manufacturer_id}
                onChange={(e) =>
                  setFormData({ ...formData, assigned_manufacturer_id: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">공장을 선택하세요</option>
                {factories.map((factory) => (
                  <option key={factory.id} value={factory.id}>
                    {factory.name || factory.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Factory Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                공장 결제 금액 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.factory_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, factory_amount: Number(e.target.value) })
                  }
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  원
                </span>
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                마감일
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) =>
                  setFormData({ ...formData, deadline: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Factory Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                결제 예정일
              </label>
              <input
                type="date"
                value={formData.factory_payment_date}
                onChange={(e) =>
                  setFormData({ ...formData, factory_payment_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Factory Payment Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                결제 상태 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.factory_payment_status}
                onChange={(e) =>
                  setFormData({ ...formData, factory_payment_status: e.target.value as 'pending' | 'completed' | 'cancelled' })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="pending">대기</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? '처리중...' : '배정하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
