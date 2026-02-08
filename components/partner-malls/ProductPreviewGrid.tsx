'use client';

import { useState, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import { Edit2, Check, Loader2, Package } from 'lucide-react';
import { Product, ProductSide, LogoPlacement } from '@/types/types';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';

interface ProductPlacement {
  productId: string;
  placements: Record<string, LogoPlacement>;
  canvasStates: Record<string, unknown>;
}

interface ProductPreviewGridProps {
  products: Product[];
  logoUrl: string;
  placements: ProductPlacement[];
  onEditProduct: (productIndex: number, sideIndex: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

interface PreviewItem {
  productId: string;
  productTitle: string;
  sideId: string;
  sideName: string;
  side: ProductSide;
  placement: LogoPlacement | null;
  productIndex: number;
  sideIndex: number;
}

// Individual preview card component that uses SingleSideCanvas
function PreviewCard({
  item,
  logoUrl,
  onEdit,
}: {
  item: PreviewItem;
  logoUrl: string;
  onEdit: () => void;
}) {
  const [isReady, setIsReady] = useState(false);

  // Handle canvas ready - add logo
  const handleCanvasReady = useCallback((canvas: fabric.Canvas, _sideId: string, _canvasScale: number) => {
    if (!item.placement) {
      setIsReady(true);
      return;
    }

    // Get print area properties from canvas
    // @ts-expect-error - Custom property
    const printAreaLeft = canvas.printAreaLeft || 0;
    // @ts-expect-error - Custom property
    const printAreaTop = canvas.printAreaTop || 0;

    // Load and add logo
    fabric.FabricImage.fromURL(logoUrl, { crossOrigin: 'anonymous' })
      .then((logoImg) => {
        const placement = item.placement!;

        // Calculate logo scale
        const logoScale = Math.min(
          placement.width / (logoImg.width || 100),
          placement.height / (logoImg.height || 100)
        );

        // Scale down for preview size (160x200 is 0.4x of 400x500)
        const previewScale = 0.4;

        logoImg.set({
          left: printAreaLeft + placement.x * previewScale,
          top: printAreaTop + placement.y * previewScale,
          scaleX: logoScale * previewScale,
          scaleY: logoScale * previewScale,
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false,
          data: { id: 'partner-mall-logo' },
        });

        canvas.add(logoImg);
        canvas.renderAll();
        setIsReady(true);
      })
      .catch((err) => {
        console.error('Error loading logo for preview:', err);
        setIsReady(true);
      });
  }, [item.placement, logoUrl]);

  // Preview canvas dimensions (scaled down from 400x500)
  const previewWidth = 160;
  const previewHeight = 200;

  return (
    <div className="relative group">
      {/* Preview canvas */}
      <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ width: previewWidth, height: previewHeight }}>
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
        <div style={{ opacity: isReady ? 1 : 0.3, transition: 'opacity 0.3s' }}>
          <SingleSideCanvas
            key={`${item.productId}-${item.sideId}`}
            side={item.side}
            width={previewWidth}
            height={previewHeight}
            isEdit={false}
            canvasState={{ objects: [] }}
            onCanvasReady={handleCanvasReady}
          />
        </div>
      </div>

      {/* Edit overlay */}
      <button
        onClick={onEdit}
        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
      >
        <div className="bg-white rounded-full p-2">
          <Edit2 className="w-5 h-5 text-gray-700" />
        </div>
      </button>

      {/* Placement indicator */}
      {item.placement && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Product info */}
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-800 truncate">
          {item.productTitle}
        </p>
        <p className="text-xs text-gray-500">{item.sideName}</p>
      </div>
    </div>
  );
}

export default function ProductPreviewGrid({
  products,
  logoUrl,
  placements,
  onEditProduct,
  onConfirm,
  onBack,
}: ProductPreviewGridProps) {
  const [previews, setPreviews] = useState<PreviewItem[]>([]);

  // Generate preview items (first side only for each product)
  useEffect(() => {
    const items: PreviewItem[] = [];

    products.forEach((product, productIndex) => {
      const productPlacement = placements.find((p) => p.productId === product.id);
      const sides = (product.configuration || []) as ProductSide[];

      // Only use the first side (front) of each product
      if (sides.length > 0) {
        const side = sides[0];
        const placement = productPlacement?.placements[side.id] || null;

        items.push({
          productId: product.id,
          productTitle: product.title,
          sideId: side.id,
          sideName: side.name,
          side,
          placement,
          productIndex,
          sideIndex: 0,
        });
      }
    });

    setPreviews(items);
  }, [products, placements]);

  // Handle edit
  const handleEdit = (productIndex: number, sideIndex: number) => {
    onEditProduct(productIndex, sideIndex);
  };

  const placedCount = previews.filter((p) => p.placement).length;

  return (
    <div className="bg-white rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-2">미리보기</h2>
      <p className="text-gray-600 mb-6">
        모든 제품에 로고가 적용된 모습입니다. 수정이 필요하면 해당 제품을 클릭하세요.
      </p>

      {/* Preview grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[500px] overflow-y-auto p-1">
        {previews.length > 0 ? (
          previews.map((item) => (
            <PreviewCard
              key={`${item.productId}-${item.sideId}`}
              item={item}
              logoUrl={logoUrl}
              onEdit={() => handleEdit(item.productIndex, item.sideIndex)}
            />
          ))
        ) : (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">제품이 없습니다</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          총 {previews.length}개 제품의 앞면에 로고가 적용됩니다.
          {placedCount}개 완료됨.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          배치 수정
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          저장하기
        </button>
      </div>
    </div>
  );
}
