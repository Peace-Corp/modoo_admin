'use client';

import { useState, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Product, LogoPlacement } from '@/types/types';
import ProductMultiSelect from './ProductMultiSelect';
import LogoPlacementEditor from './LogoPlacementEditor';

interface ProductPlacement {
  productId: string;
  placements: Record<string, LogoPlacement>;
  canvasStates: Record<string, unknown>;
}

interface AddProductsModalProps {
  partnerMallId: string;
  existingProductIds: string[];
  logoUrl: string;
  onClose: () => void;
  onProductsAdded: () => void;
}

type Step = 'select' | 'placement' | 'saving';

export default function AddProductsModal({
  partnerMallId,
  existingProductIds,
  logoUrl,
  onClose,
  onProductsAdded,
}: AddProductsModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [placements, setPlacements] = useState<ProductPlacement[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch full product details after selection
  const fetchSelectedProducts = useCallback(async (productIds: string[]) => {
    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) {
        throw new Error('제품 정보를 불러오지 못했습니다.');
      }
      const result = await response.json();
      const allProducts: Product[] = result.data || [];
      const selected = allProducts.filter((p) => productIds.includes(p.id));
      setSelectedProducts(selected);
      return selected;
    } catch (err) {
      console.error('Fetch products error:', err);
      throw err;
    }
  }, []);

  // Handle product selection confirm
  const handleSelectionConfirm = async () => {
    if (selectedProductIds.length === 0) {
      setError('최소 1개의 제품을 선택해주세요.');
      return;
    }

    setError(null);
    try {
      await fetchSelectedProducts(selectedProductIds);
      setStep('placement');
    } catch (err) {
      setError(err instanceof Error ? err.message : '제품 정보를 불러오지 못했습니다.');
    }
  };

  // Handle placement confirm and save
  const handlePlacementConfirm = async () => {
    setStep('saving');
    setError(null);

    try {
      // Prepare products data for API
      const productsData = placements.map((p) => ({
        product_id: p.productId,
        logo_placements: p.placements,
        canvas_state: p.canvasStates,
      }));

      // Also include products that weren't explicitly placed (use empty placement)
      const placedProductIds = new Set(placements.map((p) => p.productId));
      selectedProducts.forEach((product) => {
        if (!placedProductIds.has(product.id)) {
          productsData.push({
            product_id: product.id,
            logo_placements: {},
            canvas_state: {},
          });
        }
      });

      const response = await fetch('/api/admin/partner-malls/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_mall_id: partnerMallId,
          products: productsData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || '제품 추가에 실패했습니다.');
      }

      onProductsAdded();
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : '제품 추가에 실패했습니다.');
      setStep('placement');
    }
  };

  // Render based on current step
  if (step === 'saving') {
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

  if (step === 'placement') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          <LogoPlacementEditor
            products={selectedProducts}
            logoUrl={logoUrl}
            placements={placements}
            onPlacementsChange={setPlacements}
            onConfirm={handlePlacementConfirm}
            onBack={() => setStep('select')}
          />
        </div>
      </div>
    );
  }

  // step === 'select'
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">제품 추가</h3>
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
