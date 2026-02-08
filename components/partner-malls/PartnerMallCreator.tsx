'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { Product, LogoPlacement } from '@/types/types';
import LogoCapture from './LogoCapture';
import ProductMultiSelect from './ProductMultiSelect';
import LogoPlacementEditor from './LogoPlacementEditor';
import ProductPreviewGrid from './ProductPreviewGrid';

type Step = 'logo' | 'products' | 'placement' | 'preview' | 'save';

interface ProductPlacement {
  productId: string;
  placements: Record<string, LogoPlacement>;
  canvasStates: Record<string, unknown>;
}

interface PartnerMallCreatorProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function PartnerMallCreator({ onClose, onCreated }: PartnerMallCreatorProps) {
  const [currentStep, setCurrentStep] = useState<Step>('logo');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [originalLogoUrl, setOriginalLogoUrl] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [placements, setPlacements] = useState<ProductPlacement[]>([]);
  const [partnerMallName, setPartnerMallName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For editing specific product/side from preview
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);
  const [editingSideIndex, setEditingSideIndex] = useState<number | null>(null);

  // Fetch products when IDs are selected
  useEffect(() => {
    if (selectedProductIds.length === 0) {
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/admin/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        const result = await response.json();
        const allProducts = result.data || [];
        const selected = allProducts.filter((p: Product) =>
          selectedProductIds.includes(p.id)
        );
        setProducts(selected);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };

    fetchProducts();
  }, [selectedProductIds]);

  // Handle logo ready
  const handleLogoReady = (processedUrl: string, originalUrl: string) => {
    setLogoUrl(processedUrl);
    setOriginalLogoUrl(originalUrl);
    setCurrentStep('products');
  };

  // Handle product selection confirm
  const handleProductsConfirm = () => {
    setCurrentStep('placement');
  };

  // Handle placement confirm
  const handlePlacementConfirm = () => {
    setCurrentStep('preview');
  };

  // Handle edit from preview
  const handleEditProduct = (productIndex: number, sideIndex: number) => {
    setEditingProductIndex(productIndex);
    setEditingSideIndex(sideIndex);
    setCurrentStep('placement');
  };

  // Handle save
  const handleSave = async () => {
    if (!partnerMallName.trim()) {
      setError('파트너몰 이름을 입력해주세요.');
      return;
    }

    if (!logoUrl) {
      setError('로고가 필요합니다.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Create partner mall
      const createResponse = await fetch('/api/admin/partner-malls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partnerMallName.trim(),
          logo_url: logoUrl,
          original_logo_url: originalLogoUrl,
          is_active: true,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData?.error || '파트너몰 생성에 실패했습니다.');
      }

      const createResult = await createResponse.json();
      const partnerMallId = createResult.data.id;

      // Add products with placements
      if (placements.length > 0) {
        const productsData = placements.map((p) => ({
          product_id: p.productId,
          logo_placements: p.placements,
          canvas_state: p.canvasStates,
        }));

        const productsResponse = await fetch('/api/admin/partner-malls/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner_mall_id: partnerMallId,
            products: productsData,
          }),
        });

        if (!productsResponse.ok) {
          const errorData = await productsResponse.json().catch(() => ({}));
          throw new Error(errorData?.error || '제품 추가에 실패했습니다.');
        }
      }

      onCreated();
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // Step indicator
  const steps = [
    { id: 'logo', label: '로고 업로드' },
    { id: 'products', label: '제품 선택' },
    { id: 'placement', label: '로고 배치' },
    { id: 'preview', label: '미리보기' },
    { id: 'save', label: '저장' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-semibold">파트너몰 생성</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    index < currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : index === currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`ml-2 text-sm hidden sm:block ${
                    index <= currentStepIndex ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 sm:w-16 h-0.5 mx-2 ${
                      index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Logo Capture */}
          {currentStep === 'logo' && (
            <LogoCapture onLogoReady={handleLogoReady} onCancel={onClose} />
          )}

          {/* Step 2: Product Selection */}
          {currentStep === 'products' && (
            <ProductMultiSelect
              selectedProductIds={selectedProductIds}
              onSelectionChange={setSelectedProductIds}
              onConfirm={handleProductsConfirm}
              onBack={() => setCurrentStep('logo')}
            />
          )}

          {/* Step 3: Logo Placement */}
          {currentStep === 'placement' && logoUrl && products.length > 0 && (
            <LogoPlacementEditor
              products={products}
              logoUrl={logoUrl}
              placements={placements}
              onPlacementsChange={setPlacements}
              onConfirm={handlePlacementConfirm}
              onBack={() => setCurrentStep('products')}
            />
          )}

          {/* Step 4: Preview */}
          {currentStep === 'preview' && logoUrl && products.length > 0 && (
            <ProductPreviewGrid
              products={products}
              logoUrl={logoUrl}
              placements={placements}
              onEditProduct={handleEditProduct}
              onConfirm={() => setCurrentStep('save')}
              onBack={() => setCurrentStep('placement')}
            />
          )}

          {/* Step 5: Save */}
          {currentStep === 'save' && (
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">파트너몰 저장</h2>
              <p className="text-gray-600 mb-6">
                파트너몰의 이름을 입력하고 저장하세요.
              </p>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Logo preview */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">로고</p>
                    <p className="text-xs text-gray-500">
                      배경이 제거된 로고 이미지
                    </p>
                  </div>
                </div>

                {/* Partner mall name input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    파트너몰 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={partnerMallName}
                    onChange={(e) => setPartnerMallName(e.target.value)}
                    placeholder="예: 삼성전자, LG생활건강"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Summary */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {products.length}개 제품에 로고가 적용됩니다.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setCurrentStep('preview')}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !partnerMallName.trim()}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      저장하기
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
