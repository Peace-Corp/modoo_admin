'use client';

import { useState, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Product, LogoPlacement, ProductSide } from '@/types/types';
import ProductMultiSelect from './ProductMultiSelect';

interface AddProductsModalProps {
  partnerMallId: string;
  existingProductIds: string[];
  logoUrl: string;
  onClose: () => void;
  onProductsAdded: () => void;
}

// Calculate left-chest placement for a product side
const getLeftChestPlacement = (side: ProductSide): LogoPlacement => {
  const { width, height } = side.printArea;
  return {
    x: Math.round(width * 0.15),
    y: Math.round(height * 0.15),
    width: Math.round(width * 0.2),
    height: Math.round(height * 0.2),
  };
};

// Get first side of a product
const getFirstSide = (product: Product): ProductSide | null => {
  const sides = (product.configuration || []) as ProductSide[];
  return sides.length > 0 ? sides[0] : null;
};

export default function AddProductsModal({
  partnerMallId,
  existingProductIds,
  logoUrl,
  onClose,
  onProductsAdded,
}: AddProductsModalProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle product selection confirm - auto-generate left-chest placements and save
  const handleSelectionConfirm = useCallback(async () => {
    if (selectedProductIds.length === 0) {
      setError('최소 1개의 제품을 선택해주세요.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      // Fetch selected products
      const response = await fetch('/api/admin/products');
      if (!response.ok) {
        throw new Error('제품 정보를 불러오지 못했습니다.');
      }
      const result = await response.json();
      const allProducts: Product[] = result.data || [];
      const selectedProducts = allProducts.filter((p) => selectedProductIds.includes(p.id));

      // Auto-generate left-chest placements for all products
      const productsData = selectedProducts.map((product) => {
        const firstSide = getFirstSide(product);
        if (!firstSide) {
          return {
            product_id: product.id,
            logo_placements: {},
            canvas_state: {},
          };
        }

        const placement = getLeftChestPlacement(firstSide);
        return {
          product_id: product.id,
          logo_placements: { [firstSide.id]: placement },
          canvas_state: {},
        };
      });

      // Save to API
      const saveResponse = await fetch('/api/admin/partner-malls/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_mall_id: partnerMallId,
          products: productsData,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData?.error || '제품 추가에 실패했습니다.');
      }

      onProductsAdded();
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : '제품 추가에 실패했습니다.');
      setIsSaving(false);
    }
  }, [selectedProductIds, partnerMallId, onProductsAdded]);

  if (isSaving) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">제품을 추가하는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">제품 추가</h3>
            <p className="text-sm text-gray-500">로고는 왼쪽 가슴 위치에 자동 배치됩니다.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <ProductMultiSelect
            selectedProductIds={selectedProductIds}
            onSelectionChange={setSelectedProductIds}
            onConfirm={handleSelectionConfirm}
            onBack={onClose}
            excludeProductIds={existingProductIds}
          />
        </div>
      </div>
    </div>
  );
}
