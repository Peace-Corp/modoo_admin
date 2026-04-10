'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, CheckCircle2, Package, Search, X, Copy, Check, ExternalLink,
  Clock, Link2, Plus, Trash2, ChevronDown, ChevronUp, Minus,
} from 'lucide-react';
import { Product, SizeOption } from '@/types/types';
import OrderDetailsForm from './OrderDetailsForm';

type Step = 'items' | 'product-select' | 'details' | 'success';
type PaymentType = 'completed' | 'bank_transfer' | 'customer_payment';

export interface OrderVariant {
  sizeLabel: string;
  sizeCode: string;
  quantity: number;
}

export interface OrderItemDraft {
  id: string;
  productId: string;
  productTitle: string;
  productThumbnail: string | null;
  designId: string;
  designPreviewUrl: string | null;
  basePrice: number;
  sizeOptions: SizeOption[];
  variants: OrderVariant[];
  pricingMode: 'auto' | 'custom_unit_price';
  customUnitPrice: string;
  designPricePerItem: number | null;
}

export interface OrderCreateResult {
  orderId: string;
  totalAmount: number;
  originalAmount: number;
  totalQuantity: number;
  paymentType: PaymentType;
  paymentLinkToken: string | null;
  paymentLinkUrl: string | null;
}

interface AdminOrderCreatorProps {
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
  initialProductId?: string;
  initialDesignId?: string;
}

const SESSION_KEY = 'admin_order_draft_items';

function saveItemsToSession(items: OrderItemDraft[]) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(items)); } catch { /* noop */ }
}

function loadItemsFromSession(): OrderItemDraft[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function clearItemsSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

export function getItemUnitPrice(item: OrderItemDraft): number {
  if (item.pricingMode === 'custom_unit_price') {
    const parsed = parseFloat(item.customUnitPrice);
    return parsed > 0 ? parsed : 0;
  }
  return item.designPricePerItem ?? item.basePrice;
}

export function getItemTotalQuantity(item: OrderItemDraft): number {
  return item.variants.reduce((sum, v) => sum + v.quantity, 0);
}

export function getItemSubtotal(item: OrderItemDraft): number {
  return getItemUnitPrice(item) * getItemTotalQuantity(item);
}

export default function AdminOrderCreator({
  onClose, onSuccess, initialProductId, initialDesignId,
}: AdminOrderCreatorProps) {
  const router = useRouter();

  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>('items');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderCreateResult | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const response = await fetch('/api/admin/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        const fetched: Product[] = data.data || [];
        setProducts(fetched);

        const existingItems = loadItemsFromSession();
        clearItemsSession();

        if (initialProductId && initialDesignId) {
          const product = fetched.find(p => p.id === initialProductId);
          if (product) {
            let designPreviewUrl: string | null = null;
            let designPricePerItem: number | null = null;
            try {
              const res = await fetch(`/api/admin/designs/${initialDesignId}`);
              if (res.ok) {
                const d = await res.json();
                designPreviewUrl = d?.data?.preview_url || null;
                const price = d?.data?.price_per_item;
                if (price && price > 0) designPricePerItem = price;
              }
            } catch { /* noop */ }

            const sizeOpts = product.size_options || [];
            const newItem: OrderItemDraft = {
              id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              productId: product.id,
              productTitle: product.title,
              productThumbnail: product.thumbnail_image_link?.[0] || null,
              designId: initialDesignId,
              designPreviewUrl,
              basePrice: product.base_price,
              sizeOptions: sizeOpts,
              variants: sizeOpts.map(o => ({ sizeLabel: o.label, sizeCode: o.size_code, quantity: 0 })),
              pricingMode: 'auto',
              customUnitPrice: '',
              designPricePerItem,
            };
            setItems([...existingItems, newItem]);
            setExpandedItemId(newItem.id);
          } else {
            setItems(existingItems);
          }
        } else {
          setItems(existingItems);
        }
      } catch (err) {
        console.error('Error initializing:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [initialProductId, initialDesignId]);

  const filteredProducts = products.filter(p =>
    p.is_active && (
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const orderTotalQuantity = useMemo(
    () => items.reduce((s, i) => s + getItemTotalQuantity(i), 0),
    [items],
  );
  const orderSubtotal = useMemo(
    () => items.reduce((s, i) => s + getItemSubtotal(i), 0),
    [items],
  );

  const handleAddProduct = () => {
    saveItemsToSession(items);
    setSearchQuery('');
    setCurrentStep('product-select');
  };

  const handleProductSelect = (product: Product) => {
    saveItemsToSession(items);
    const returnUrl = encodeURIComponent(`/orders?resumeProductId=${product.id}`);
    router.push(`/editor/${product.id}?mode=design&returnUrl=${returnUrl}`);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    if (expandedItemId === itemId) setExpandedItemId(null);
  };

  const handleVariantQtyChange = (itemId: string, idx: number, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const vs = [...item.variants];
      vs[idx] = { ...vs[idx], quantity: Math.max(0, vs[idx].quantity + delta) };
      return { ...item, variants: vs };
    }));
  };

  const handleVariantQtyInput = (itemId: string, idx: number, value: string) => {
    const q = parseInt(value, 10);
    if (isNaN(q) || q < 0) return;
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const vs = [...item.variants];
      vs[idx] = { ...vs[idx], quantity: q };
      return { ...item, variants: vs };
    }));
  };

  const handleProceedToDetails = () => {
    setItemError(null);
    for (const item of items) {
      if (getItemTotalQuantity(item) <= 0) {
        setItemError(`"${item.productTitle}" 제품의 수량을 입력해주세요.`);
        setExpandedItemId(item.id);
        return;
      }
      if (item.pricingMode === 'custom_unit_price' && getItemUnitPrice(item) <= 0) {
        setItemError(`"${item.productTitle}" 제품의 단가를 입력해주세요.`);
        setExpandedItemId(item.id);
        return;
      }
    }
    setCurrentStep('details');
  };

  const handleOrderCreated = (orderId: string, result?: OrderCreateResult) => {
    clearItemsSession();
    setCreatedOrderId(orderId);
    setOrderResult(result ?? null);
    setCurrentStep('success');
    onSuccess?.(orderId);
  };

  const handleClose = () => {
    clearItemsSession();
    onClose();
  };

  const handleCopyLink = async () => {
    if (!orderResult?.paymentLinkUrl) return;
    try {
      await navigator.clipboard.writeText(orderResult.paymentLinkUrl);
    } catch {
      const input = document.createElement('input');
      input.value = orderResult.paymentLinkUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const stepLabel = (() => {
    switch (currentStep) {
      case 'items': return items.length === 0 ? '제품을 추가하여 주문을 구성하세요' : '제품별 수량과 가격을 설정하세요';
      case 'product-select': return '추가할 제품을 선택하세요';
      case 'details': return '주문 정보를 입력하세요';
      case 'success': return '주문이 생성되었습니다';
      default: return '';
    }
  })();

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          {(currentStep === 'product-select' || currentStep === 'details') && (
            <button
              onClick={() => setCurrentStep(currentStep === 'details' ? 'items' : 'items')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold">주문 생성하기</h2>
            <p className="text-sm text-gray-500">{stepLabel}</p>
          </div>
        </div>
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Progress */}
      {currentStep !== 'success' && (
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-4 max-w-2xl mx-auto">
            {[
              { key: 'items', label: '제품/디자인' },
              { key: 'details', label: '주문 정보' },
            ].map((s, idx) => {
              const stepIdx = s.key === 'items' ? 0 : 1;
              const currentIdx = currentStep === 'details' ? 1 : 0;
              const isCompleted = currentIdx > stepIdx;
              const isCurrent = currentIdx === stepIdx;
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    isCurrent ? 'bg-blue-600 text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className={`ml-2 text-sm ${isCurrent ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {s.label}
                  </span>
                  {idx < 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-4" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ============ Items Step ============ */}
        {!loading && currentStep === 'items' && (
          <div className="p-6">
            <div className="max-w-3xl mx-auto">
              {itemError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {itemError}
                </div>
              )}

              {items.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">주문에 제품을 추가하세요</h3>
                  <p className="text-gray-500 mb-6">제품을 선택하고 디자인하여 주문에 추가합니다</p>
                  <button
                    onClick={handleAddProduct}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    제품 추가
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {items.map((item, itemIndex) => {
                      const isExpanded = expandedItemId === item.id;
                      const qty = getItemTotalQuantity(item);
                      const unitP = getItemUnitPrice(item);
                      const sub = getItemSubtotal(item);

                      return (
                        <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          {/* Compact header */}
                          <div className="p-4 flex items-center gap-4">
                            <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                              {item.designPreviewUrl || item.productThumbnail ? (
                                <img
                                  src={item.designPreviewUrl || item.productThumbnail!}
                                  alt={item.productTitle}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Package className="w-6 h-6 text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                <span className="text-xs text-gray-400 mr-1">#{itemIndex + 1}</span>
                                {item.productTitle}
                              </p>
                              <p className="text-sm text-gray-500">
                                {unitP.toLocaleString()}원 × {qty}개 = <span className="font-medium text-gray-700">{sub.toLocaleString()}원</span>
                              </p>
                            </div>
                            <button
                              onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t bg-gray-50 p-4 space-y-4">
                              {/* Size / Quantity */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">사이즈 및 수량</label>
                                <div className="space-y-2">
                                  {item.variants.map((v, vi) => (
                                    <div key={v.sizeCode} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                      <div className="flex items-center gap-3">
                                        <span className="font-medium text-gray-900 w-12 text-sm">{v.sizeLabel}</span>
                                        <span className="text-xs text-gray-400">({v.sizeCode})</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleVariantQtyChange(item.id, vi, -1)}
                                          disabled={v.quantity <= 0}
                                          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          value={v.quantity}
                                          onChange={(e) => handleVariantQtyInput(item.id, vi, e.target.value)}
                                          className="w-14 text-center p-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                          onClick={() => handleVariantQtyChange(item.id, vi, 1)}
                                          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  {item.variants.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-4">사이즈 옵션이 없습니다.</p>
                                  )}
                                </div>
                              </div>

                              {/* Per-item pricing */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">단가 설정</label>
                                <div className="flex flex-wrap gap-3 mb-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      checked={item.pricingMode === 'auto'}
                                      onChange={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, pricingMode: 'auto' as const } : i))}
                                      className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                      자동 ({(item.designPricePerItem ?? item.basePrice).toLocaleString()}원/개)
                                    </span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      checked={item.pricingMode === 'custom_unit_price'}
                                      onChange={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, pricingMode: 'custom_unit_price' as const } : i))}
                                      className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-sm text-gray-700">직접 입력</span>
                                  </label>
                                </div>
                                {item.pricingMode === 'custom_unit_price' && (
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.customUnitPrice}
                                      onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, customUnitPrice: e.target.value } : i))}
                                      placeholder="개당 단가"
                                      className="w-full p-2.5 pr-14 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원/개</span>
                                  </div>
                                )}
                              </div>

                              {/* Item subtotal */}
                              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                <span className="text-sm font-medium text-gray-600">소계</span>
                                <span className="text-sm font-bold text-gray-900">{sub.toLocaleString()}원</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Order subtotal bar */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-600">{items.length}개 제품 · </span>
                        <span className="text-sm text-gray-600">총 {orderTotalQuantity}개</span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">{orderSubtotal.toLocaleString()}원</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={handleAddProduct}
                      className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      제품 추가
                    </button>
                    <button
                      onClick={handleProceedToDetails}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      다음: 주문 정보
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ============ Product Select Step ============ */}
        {!loading && currentStep === 'product-select' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="제품명 또는 카테고리로 검색..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        {product.thumbnail_image_link?.[0] ? (
                          <img src={product.thumbnail_image_link[0]} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-12 h-12 text-gray-300" />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-500">{product.category || '카테고리 없음'}</p>
                        <p className="font-medium text-gray-900 truncate">{product.title}</p>
                        <p className="text-sm text-blue-600">{product.base_price.toLocaleString()}원</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ Details Step ============ */}
        {!loading && currentStep === 'details' && items.length > 0 && (
          <OrderDetailsForm
            items={items}
            onSubmit={handleOrderCreated}
            onBack={() => setCurrentStep('items')}
          />
        )}

        {/* ============ Success Step ============ */}
        {currentStep === 'success' && createdOrderId && (
          <div className="flex items-center justify-center min-h-full py-12">
            <div className="text-center max-w-md mx-auto px-6">
              <CheckCircle2 className="w-20 h-20 mx-auto mb-6 text-green-600" />
              <h3 className="text-2xl font-bold mb-2">주문이 생성되었습니다!</h3>
              <p className="text-gray-600 mb-6">주문 ID: {createdOrderId}</p>

              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                <p className="text-sm text-gray-500 mb-2">제품 ({items.length}건)</p>
                {items.map((item, idx) => (
                  <p key={item.id} className="font-medium text-gray-900 text-sm">
                    {idx + 1}. {item.productTitle} ({getItemTotalQuantity(item)}개)
                  </p>
                ))}
              </div>

              {orderResult && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">결제 금액</span>
                    <span className="font-medium">{orderResult.totalAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">결제 방식</span>
                    <span className="font-medium">
                      {orderResult.paymentType === 'completed' && '결제 완료'}
                      {orderResult.paymentType === 'bank_transfer' && '무통장입금 대기'}
                      {orderResult.paymentType === 'customer_payment' && '고객 온라인 결제'}
                    </span>
                  </div>
                </div>
              )}

              {orderResult?.paymentType === 'bank_transfer' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-800">입금 확인 대기 중</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        고객의 입금이 확인되면 주문 상세 페이지에서 결제 완료 처리를 해주세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {orderResult?.paymentType === 'customer_payment' && orderResult.paymentLinkUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                  <div className="flex items-start gap-2 mb-3">
                    <Link2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-blue-800">고객 결제 링크</p>
                      <p className="text-sm text-blue-700 mt-1">
                        아래 링크를 고객에게 공유하면 디자인 확인 후 결제할 수 있습니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={orderResult.paymentLinkUrl}
                      className="flex-1 p-2 text-sm border border-blue-200 rounded bg-white text-gray-700 truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm whitespace-nowrap"
                    >
                      {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {linkCopied ? '복사됨' : '복사'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => createdOrderId && window.open(`/orders/${createdOrderId}`, '_blank')}
                  className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  주문 보기
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  완료
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
