'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Package, MapPin, Calendar, Clock } from 'lucide-react';
import type { OrderItem, Product, ProductSide, CanvasState, CustomFont } from '@/types/types';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';
import { createClient } from '@/lib/supabase-client';

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

const parseCanvasState = (value: unknown): CanvasState | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value as CanvasState;
};

const coerceCustomFonts = (value: unknown): CustomFont[] => {
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  if (!Array.isArray(parsed)) return [];

  const fonts: CustomFont[] = [];
  parsed.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const fontFamily = typeof raw.fontFamily === 'string' ? raw.fontFamily : '';
    const url = typeof raw.url === 'string' ? raw.url : '';
    if (!fontFamily || !url) return;
    fonts.push({
      fontFamily,
      fileName: typeof raw.fileName === 'string' ? raw.fileName : `${fontFamily}.ttf`,
      url,
      path: typeof raw.path === 'string' ? raw.path : undefined,
      uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : undefined,
      format: typeof raw.format === 'string' ? raw.format : undefined,
    });
  });

  return fonts;
};

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
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
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

      // Fetch product details for each unique product
      const productIds = [...new Set(data.items.map((item: PublicOrderItem) => item.product_id))] as string[];
      await fetchProducts(productIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : '주문 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (productIds: string[]) => {
    const supabase = createClient();
    const productMap = new Map<string, Product>();

    for (const productId of productIds) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (!error && data) {
          productMap.set(productId, data);
        }
      } catch {
        console.error('Error fetching product:', productId);
      }
    }

    setProducts(productMap);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const selectedProduct = useMemo(() => {
    if (!selectedItem) return null;
    return products.get(selectedItem.product_id) || null;
  }, [selectedItem, products]);

  const getItemColorHex = useCallback((item: PublicOrderItem) => {
    const variants = item.item_options?.variants;
    if (Array.isArray(variants) && variants.length > 0 && variants[0]?.color_hex) {
      return variants[0].color_hex;
    }
    return item.item_options?.color_hex || '#FFFFFF';
  }, []);

  const customFonts = useMemo(() => {
    if (!selectedItem) return [];
    return coerceCustomFonts(selectedItem.custom_fonts);
  }, [selectedItem]);

  // Size quantities for selected item
  const sizeQuantities = useMemo(() => {
    if (!selectedItem || !selectedProduct) return new Map<string, number>();

    interface SizeOptionObj {
      label: string;
      size_code: string;
    }
    const rawSizeOptions = (selectedProduct?.size_options ?? []) as (string | SizeOptionObj)[];
    const sizeOptions: SizeOptionObj[] = rawSizeOptions.map((opt) =>
      typeof opt === 'string' ? { label: opt, size_code: opt } : opt
    );

    if (!sizeOptions.length) return new Map<string, number>();

    const map = new Map<string, number>();

    const findSizeOption = (sizeId?: string, sizeName?: string): SizeOptionObj | undefined => {
      if (sizeId) {
        const byCode = sizeOptions.find((opt) => opt.size_code.toLowerCase() === sizeId.toLowerCase());
        if (byCode) return byCode;
      }
      if (sizeName) {
        const byLabel = sizeOptions.find((opt) => opt.label.toLowerCase() === sizeName.toLowerCase());
        if (byLabel) return byLabel;
      }
      const fallbackLabel = sizeName || sizeId || 'unknown';
      return { label: fallbackLabel, size_code: sizeId || fallbackLabel };
    };

    const addQuantity = (sizeId?: string, sizeName?: string, quantity?: number) => {
      if (!quantity || quantity <= 0) return;
      const sizeOpt = findSizeOption(sizeId, sizeName);
      if (!sizeOpt) return;
      const key = sizeOpt.size_code;
      map.set(key, (map.get(key) || 0) + quantity);
    };

    const variants = selectedItem.item_options?.variants ?? [];
    if (variants.length > 0) {
      variants.forEach((variant) => {
        addQuantity(variant.size_id, variant.size_name, variant.quantity);
      });
    } else {
      addQuantity(selectedItem.item_options?.size_id, selectedItem.item_options?.size_name, selectedItem.quantity);
    }

    return map;
  }, [selectedItem, selectedProduct]);

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
                {items.map((item) => {
                  const product = products.get(item.product_id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id === selectedItemId ? null : item.id)}
                      className={`flex gap-4 p-3 border rounded-lg cursor-pointer transition-all ${
                        item.id === selectedItemId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
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
                          {item.id === selectedItemId ? '클릭하여 닫기' : '클릭하여 디자인 보기'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Design Preview - Shows when item is selected */}
            {selectedItem && selectedProduct && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  디자인 미리보기 - {selectedItem.product_title}
                </h2>

                {/* Size Quantity Table */}
                {selectedProduct.size_options && selectedProduct.size_options.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">사이즈별 수량</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse border border-gray-200 rounded">
                        <thead className="bg-gray-50">
                          <tr>
                            {(selectedProduct.size_options as Array<{ label: string; size_code: string } | string>).map((size) => {
                              const sizeObj = typeof size === 'string' ? { label: size, size_code: size } : size;
                              return (
                                <th key={sizeObj.size_code} className="px-3 py-2 text-center font-medium border border-gray-200">
                                  {sizeObj.label}
                                </th>
                              );
                            })}
                            <th className="px-3 py-2 text-center font-medium border border-gray-200 bg-gray-100">합계</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {(selectedProduct.size_options as Array<{ label: string; size_code: string } | string>).map((size) => {
                              const sizeObj = typeof size === 'string' ? { label: size, size_code: size } : size;
                              const quantity = sizeQuantities.get(sizeObj.size_code);
                              return (
                                <td key={sizeObj.size_code} className="px-3 py-2 text-center border border-gray-200">
                                  {quantity && quantity > 0 ? quantity : '-'}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center border border-gray-200 bg-gray-100 font-semibold">
                              {Array.from(sizeQuantities.values()).reduce((sum, qty) => sum + qty, 0) || '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Canvas Previews */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {selectedProduct.configuration.map((side: ProductSide) => {
                    const canvasState = selectedItem.canvas_state[side.id];
                    if (!canvasState) return null;

                    return (
                      <div key={side.id} className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-700">{side.name}</h3>
                        <div className="flex justify-center items-center bg-gray-50 rounded-lg p-4 min-h-[400px]">
                          <SingleSideCanvas
                            side={side}
                            canvasState={canvasState}
                            productColor={getItemColorHex(selectedItem)}
                            width={350}
                            height={400}
                            renderFromCanvasStateOnly
                            customFonts={customFonts}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Shipping Info */}
          <div className="space-y-4">
            {/* Shipping Address */}
            {order.shipping_method !== 'pickup' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <h2 className="text-base font-semibold text-gray-900">배송 정보</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    {order.shipping_method === 'domestic' ? '국내 배송' : '해외 배송'}
                  </p>
                  {order.shipping_method === 'international' && order.country_code && (
                    <p className="font-medium text-gray-900">{order.country_code}</p>
                  )}
                  {order.postal_code && (
                    <p className="text-gray-900">[{order.postal_code}]</p>
                  )}
                  {order.state && order.city && (
                    <p className="text-gray-900">{order.state} {order.city}</p>
                  )}
                  {order.address_line_1 && (
                    <p className="text-gray-900">{order.address_line_1}</p>
                  )}
                  {order.address_line_2 && (
                    <p className="text-gray-900">{order.address_line_2}</p>
                  )}
                </div>
              </div>
            )}

            {order.shipping_method === 'pickup' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <h2 className="text-base font-semibold text-gray-900">수령 방법</h2>
                </div>
                <p className="text-sm text-gray-600">직접 수령</p>
              </div>
            )}

            {/* Order Summary */}
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
                <div className="flex justify-between">
                  <span className="text-gray-600">주문일시</span>
                  <span className="font-medium text-gray-900">{formatDateTime(order.created_at)}</span>
                </div>
                {order.deadline && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600">마감일</span>
                    <span className="font-semibold text-red-600">{formatDate(order.deadline)}</span>
                  </div>
                )}
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
