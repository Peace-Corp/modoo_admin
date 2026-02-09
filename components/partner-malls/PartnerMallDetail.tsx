'use client';

import { useState, useCallback } from 'react';
import * as fabric from 'fabric';
import {
  ChevronLeft,
  Building2,
  Package,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Edit2,
  Plus,
  Trash2,
  Calendar,
} from 'lucide-react';
import { PartnerMall, PartnerMallProduct, Product, ProductSide, LogoPlacement } from '@/types/types';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';
import PartnerMallInfoEditor from './PartnerMallInfoEditor';
import SingleProductPlacementEditor from './SingleProductPlacementEditor';
import AddProductsModal from './AddProductsModal';

// Product preview card - uses preview_url if available, falls back to canvas rendering
function ProductPreviewCard({
  mallProduct,
  logoUrl,
  side,
  placement,
  onEdit,
  onRemove,
  isDeleting,
}: {
  mallProduct: PartnerMallProduct;
  logoUrl: string;
  side: ProductSide;
  placement: LogoPlacement | undefined;
  onEdit: () => void;
  onRemove: () => void;
  isDeleting: boolean;
}) {
  const [isReady, setIsReady] = useState(false);
  const product = mallProduct.product;
  const previewUrl = mallProduct.preview_url;

  // Use canvas rendering only if no preview_url
  const handleCanvasReady = useCallback(
    (canvas: fabric.Canvas, _sideId: string, canvasScale: number) => {
      if (!placement) {
        setIsReady(true);
        return;
      }

      // @ts-expect-error - Custom property
      const printAreaLeft = canvas.printAreaLeft || 0;
      // @ts-expect-error - Custom property
      const printAreaTop = canvas.printAreaTop || 0;

      fabric.FabricImage.fromURL(logoUrl, { crossOrigin: 'anonymous' })
        .then((logoImg) => {
          const logoScale = Math.min(
            placement.width / (logoImg.width || 100),
            placement.height / (logoImg.height || 100)
          );

          logoImg.set({
            left: printAreaLeft + placement.x * canvasScale,
            top: printAreaTop + placement.y * canvasScale,
            scaleX: logoScale * canvasScale,
            scaleY: logoScale * canvasScale,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
          });

          canvas.add(logoImg);
          canvas.renderAll();
          setIsReady(true);
        })
        .catch((err) => {
          console.error('Error loading logo:', err);
          setIsReady(true);
        });
    },
    [logoUrl, placement]
  );

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden group">
      <div className="relative aspect-4/5 bg-white">
        {/* If preview_url exists, show image directly */}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={product?.title || 'Product preview'}
            className="w-full h-full object-contain"
            onLoad={() => setIsReady(true)}
          />
        ) : (
          <>
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: isReady ? 1 : 0.3 }}
            >
              <SingleSideCanvas
                key={`${mallProduct.id}-${side.id}`}
                side={side}
                width={160}
                height={200}
                isEdit={false}
                canvasState={{ objects: [] }}
                onCanvasReady={handleCanvasReady}
              />
            </div>
          </>
        )}

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
          <button
            onClick={onEdit}
            className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            title="로고 배치 수정"
          >
            <Edit2 className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={onRemove}
            disabled={isDeleting}
            className="p-2 bg-white rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            title="제거"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
            ) : (
              <Trash2 className="w-4 h-4 text-red-600" />
            )}
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 truncate">{product?.title}</p>
        <p className="text-xs text-gray-500 truncate">{product?.product_code}</p>
      </div>
    </div>
  );
}

interface PartnerMallDetailProps {
  partnerMall: PartnerMall;
  onBack: () => void;
  onUpdate: () => void;
  onMallUpdate: (mall: PartnerMall) => void;
}

export default function PartnerMallDetail({
  partnerMall,
  onBack,
  onUpdate,
  onMallUpdate,
}: PartnerMallDetailProps) {
  const [togglingActive, setTogglingActive] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [showAddProducts, setShowAddProducts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PartnerMallProduct | null>(null);
  const [showEditInfo, setShowEditInfo] = useState(false);

  const products = partnerMall.partner_mall_products || [];

  // Toggle active status
  const toggleActive = async () => {
    try {
      setTogglingActive(true);

      const response = await fetch('/api/admin/partner-malls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: partnerMall.id,
          is_active: !partnerMall.is_active,
        }),
      });

      if (!response.ok) {
        throw new Error('상태 변경에 실패했습니다.');
      }

      const result = await response.json();
      onMallUpdate(result.data);
    } catch (err) {
      console.error('Toggle active error:', err);
      alert(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setTogglingActive(false);
    }
  };

  // Remove product from partner mall
  const removeProduct = async (mallProduct: PartnerMallProduct) => {
    if (!confirm('이 제품을 파트너몰에서 제거하시겠습니까?')) {
      return;
    }

    try {
      setDeletingProductId(mallProduct.id);

      const response = await fetch(`/api/admin/partner-malls/products?id=${mallProduct.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('제품 제거에 실패했습니다.');
      }

      // Refresh the data
      onUpdate();
    } catch (err) {
      console.error('Remove product error:', err);
      alert(err instanceof Error ? err.message : '제품 제거에 실패했습니다.');
    } finally {
      setDeletingProductId(null);
    }
  };

  // Get first side of a product
  const getFirstSide = (product: Product) => {
    const sides = (product.configuration || []) as Array<{
      id: string;
      name: string;
      imageUrl: string;
      printArea: { x: number; y: number; width: number; height: number };
    }>;
    return sides.length > 0 ? sides[0] : null;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">파트너몰 상세</h1>
          <p className="text-gray-600">파트너몰 정보를 확인하고 제품을 관리하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section - Left (2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                제품 목록
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({products.length}개)
                </span>
              </h2>
              <button
                onClick={() => setShowAddProducts(true)}
                className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                제품 추가
              </button>
            </div>

            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg">
                <Package className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 mb-4">등록된 제품이 없습니다.</p>
                <button
                  onClick={() => setShowAddProducts(true)}
                  className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  제품 추가하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {products.map((mallProduct) => {
                  const product = mallProduct.product;
                  if (!product) return null;

                  const firstSide = getFirstSide(product);
                  if (!firstSide) {
                    return (
                      <div
                        key={mallProduct.id}
                        className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                      >
                        <div className="aspect-4/5 bg-white flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {product.title}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <ProductPreviewCard
                      key={mallProduct.id}
                      mallProduct={mallProduct}
                      logoUrl={partnerMall.logo_url}
                      side={firstSide}
                      placement={mallProduct.logo_placements?.[firstSide.id]}
                      onEdit={() => setEditingProduct(mallProduct)}
                      onRemove={() => removeProduct(mallProduct)}
                      isDeleting={deletingProductId === mallProduct.id}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mall Info Section - Right (1 column) */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">파트너몰 정보</h2>
              <button
                onClick={() => setShowEditInfo(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="편집"
              >
                <Edit2 className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                {partnerMall.logo_url ? (
                  <img
                    src={partnerMall.logo_url}
                    alt={partnerMall.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-12 h-12 text-gray-400" />
                )}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 mb-1">
                파트너몰명
              </label>
              <p className="text-lg font-semibold text-gray-800">{partnerMall.name}</p>
            </div>

            {/* Status */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 mb-1">
                상태
              </label>
              <button
                onClick={toggleActive}
                disabled={togglingActive}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  partnerMall.is_active
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {togglingActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : partnerMall.is_active ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                {partnerMall.is_active ? '활성' : '비활성'}
              </button>
            </div>

            {/* Product Count */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 mb-1">
                등록 제품
              </label>
              <div className="flex items-center gap-2 text-gray-800">
                <Package className="w-4 h-4" />
                <span>{products.length}개</span>
              </div>
            </div>

            {/* Created Date */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 mb-1">
                생성일
              </label>
              <div className="flex items-center gap-2 text-gray-800">
                <Calendar className="w-4 h-4" />
                <span>{new Date(partnerMall.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>

            {/* Updated Date */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                수정일
              </label>
              <div className="flex items-center gap-2 text-gray-800">
                <Calendar className="w-4 h-4" />
                <span>{new Date(partnerMall.updated_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Info Modal */}
      {showEditInfo && (
        <PartnerMallInfoEditor
          partnerMall={partnerMall}
          onClose={() => setShowEditInfo(false)}
          onSave={(updated) => {
            onMallUpdate(updated);
            setShowEditInfo(false);
          }}
        />
      )}

      {/* Add Products Modal */}
      {showAddProducts && (
        <AddProductsModal
          partnerMallId={partnerMall.id}
          existingProductIds={products.map((p) => p.product_id)}
          logoUrl={partnerMall.logo_url}
          onClose={() => setShowAddProducts(false)}
          onProductsAdded={() => {
            setShowAddProducts(false);
            onUpdate();
          }}
        />
      )}

      {/* Edit Placement Modal */}
      {editingProduct && (
        <SingleProductPlacementEditor
          mallProduct={editingProduct}
          logoUrl={partnerMall.logo_url}
          onClose={() => setEditingProduct(null)}
          onSave={() => {
            setEditingProduct(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
