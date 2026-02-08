'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Check, Package, Loader2 } from 'lucide-react';
import { Product } from '@/types/types';

interface ProductMultiSelectProps {
  selectedProductIds: string[];
  onSelectionChange: (productIds: string[]) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ProductMultiSelect({
  selectedProductIds,
  onSelectionChange,
  onConfirm,
  onBack,
}: ProductMultiSelectProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/admin/products');
        if (!response.ok) {
          throw new Error('제품 목록을 불러오지 못했습니다.');
        }

        const result = await response.json();
        // Only show active products
        setProducts((result.data || []).filter((p: Product) => p.is_active));
      } catch (err) {
        console.error('Fetch products error:', err);
        setError(err instanceof Error ? err.message : '제품 목록을 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.title.toLowerCase().includes(query) ||
        product.product_code?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      onSelectionChange(selectedProductIds.filter((id) => id !== productId));
    } else {
      onSelectionChange([...selectedProductIds, productId]);
    }
  };

  // Select all visible products
  const selectAll = () => {
    const allVisibleIds = filteredProducts.map((p) => p.id);
    const newSelected = new Set([...selectedProductIds, ...allVisibleIds]);
    onSelectionChange(Array.from(newSelected));
  };

  // Deselect all visible products
  const deselectAll = () => {
    const visibleIds = new Set(filteredProducts.map((p) => p.id));
    onSelectionChange(selectedProductIds.filter((id) => !visibleIds.has(id)));
  };

  // Check if a product is selected
  const isSelected = (productId: string) => selectedProductIds.includes(productId);

  // Get selected product objects
  const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id));

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-gray-600">제품 목록을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
        <button
          onClick={onBack}
          className="mt-4 py-2 px-4 text-gray-600 hover:text-gray-800"
        >
          뒤로 가기
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">제품 선택</h2>
      <p className="text-gray-600 mb-6">
        로고를 적용할 제품을 선택해주세요. 여러 개를 선택할 수 있습니다.
      </p>

      {/* Search and actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="제품명, 제품코드, 카테고리 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="py-2 px-4 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            전체 선택
          </button>
          <button
            onClick={deselectAll}
            className="py-2 px-4 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            선택 해제
          </button>
        </div>
      </div>

      {/* Selection count */}
      <div className="mb-4 text-sm text-gray-600">
        {selectedProductIds.length}개 선택됨 / 총 {products.length}개 제품
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[400px] overflow-y-auto p-1">
          {filteredProducts.map((product) => {
            const selected = isSelected(product.id);
            return (
              <button
                key={product.id}
                onClick={() => toggleProduct(product.id)}
                className={`relative p-2 rounded-lg border-2 transition-all text-left ${
                  selected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {/* Selection indicator */}
                {selected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Product image */}
                <div className="aspect-square bg-gray-100 rounded-md overflow-hidden mb-2">
                  {product.thumbnail_image_link ? (
                    <img
                      src={product.thumbnail_image_link}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Product info */}
                <p className="text-sm font-medium text-gray-800 truncate">
                  {product.title}
                </p>
                {product.product_code && (
                  <p className="text-xs text-gray-500 truncate">
                    {product.product_code}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  ₩{product.base_price.toLocaleString('ko-KR')}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected products summary */}
      {selectedProducts.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">선택된 제품:</p>
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm"
              >
                <span className="truncate max-w-[150px]">{product.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProduct(product.id);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          이전
        </button>
        <button
          onClick={onConfirm}
          disabled={selectedProductIds.length === 0}
          className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음 ({selectedProductIds.length}개 선택)
        </button>
      </div>
    </div>
  );
}
