'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { ChevronLeft, ChevronRight, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Product, ProductSide, LogoPlacement } from '@/types/types';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';

interface ProductPlacement {
  productId: string;
  placements: Record<string, LogoPlacement>; // keyed by side.id
  canvasStates: Record<string, unknown>; // keyed by side.id
}

interface LogoPlacementEditorProps {
  products: Product[];
  logoUrl: string;
  placements: ProductPlacement[];
  onPlacementsChange: (placements: ProductPlacement[]) => void;
  onConfirm: () => void;
  onBack: () => void;
}

// Get only the first side of a product (front side)
const getFirstSide = (product: Product): ProductSide | null => {
  const sides = (product.configuration || []) as ProductSide[];
  return sides.length > 0 ? sides[0] : null;
};

export default function LogoPlacementEditor({
  products,
  logoUrl,
  placements,
  onPlacementsChange,
  onConfirm,
  onBack,
}: LogoPlacementEditorProps) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const logoRef = useRef<fabric.FabricImage | null>(null);

  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const canvasWidth = 400;
  const canvasHeight = 500;

  const currentProduct = products[currentProductIndex];
  const currentSide = currentProduct ? getFirstSide(currentProduct) : null;

  // Get or create placement for current product
  const getProductPlacement = useCallback(
    (productId: string): ProductPlacement => {
      const existing = placements.find((p) => p.productId === productId);
      if (existing) return existing;
      return {
        productId,
        placements: {},
        canvasStates: {},
      };
    },
    [placements]
  );

  // Update placement for current product/side
  const updatePlacement = useCallback(
    (sideId: string, placement: LogoPlacement, canvasState?: unknown) => {
      const productId = currentProduct.id;
      const newPlacements = [...placements];
      const index = newPlacements.findIndex((p) => p.productId === productId);

      if (index >= 0) {
        newPlacements[index] = {
          ...newPlacements[index],
          placements: {
            ...newPlacements[index].placements,
            [sideId]: placement,
          },
          canvasStates: canvasState
            ? {
                ...newPlacements[index].canvasStates,
                [sideId]: canvasState,
              }
            : newPlacements[index].canvasStates,
        };
      } else {
        newPlacements.push({
          productId,
          placements: { [sideId]: placement },
          canvasStates: canvasState ? { [sideId]: canvasState } : {},
        });
      }

      onPlacementsChange(newPlacements);
    },
    [currentProduct, placements, onPlacementsChange]
  );

  // Save current canvas state using direct canvas coordinates
  const saveCurrentState = useCallback(() => {
    if (!canvasRef.current || !logoRef.current || !currentSide) return;

    const logo = logoRef.current;

    const logoLeft = logo.left || 0;
    const logoTop = logo.top || 0;
    const logoWidth = (logo.width || 100) * (logo.scaleX || 1);
    const logoHeight = (logo.height || 100) * (logo.scaleY || 1);

    const placement: LogoPlacement = {
      x: Math.round(logoLeft),
      y: Math.round(logoTop),
      width: Math.round(logoWidth),
      height: Math.round(logoHeight),
    };

    // Get canvas state (only logo)
    const logoObject = logo.toObject();
    // @ts-expect-error - Include custom data property
    logoObject.data = logo.data;
    const canvasState = {
      objects: [logoObject],
    };

    updatePlacement(currentSide.id, placement, canvasState);
  }, [currentSide, updatePlacement]);

  // Reset logo to center of canvas
  const resetToCenter = useCallback(() => {
    if (!canvasRef.current || !logoRef.current) return;

    const canvas = canvasRef.current;
    const logo = logoRef.current;

    const defaultSize = 80;
    const logoScale = Math.min(
      defaultSize / (logo.width || 100),
      defaultSize / (logo.height || 100)
    );

    logo.set({
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      scaleX: logoScale,
      scaleY: logoScale,
      angle: 0,
      originX: 'center',
      originY: 'center',
    });

    canvas.renderAll();
    saveCurrentState();
  }, [saveCurrentState]);

  // Handle canvas ready callback from SingleSideCanvas
  const handleCanvasReady = useCallback((canvas: fabric.Canvas, sideId: string, _canvasScale: number) => {
    canvasRef.current = canvas;

    if (!currentSide) return;

    // Load logo image
    fabric.FabricImage.fromURL(logoUrl, { crossOrigin: 'anonymous' })
      .then((logoImg) => {
        const productPlacement = getProductPlacement(currentProduct.id);
        const existingPlacement = productPlacement.placements[sideId];

        if (existingPlacement) {
          // Place logo at exact stored coordinates
          const logoScale = Math.min(
            existingPlacement.width / (logoImg.width || 100),
            existingPlacement.height / (logoImg.height || 100)
          );

          logoImg.set({
            left: existingPlacement.x,
            top: existingPlacement.y,
            scaleX: logoScale,
            scaleY: logoScale,
            originX: 'left',
            originY: 'top',
            data: { id: 'partner-mall-logo' },
          });
        } else {
          // Default to center of canvas
          const defaultSize = 80;
          const logoScale = Math.min(
            defaultSize / (logoImg.width || 100),
            defaultSize / (logoImg.height || 100)
          );

          logoImg.set({
            left: canvasWidth / 2,
            top: canvasHeight / 2,
            scaleX: logoScale,
            scaleY: logoScale,
            originX: 'center',
            originY: 'center',
            data: { id: 'partner-mall-logo' },
          });
        }

        logoRef.current = logoImg;
        canvas.add(logoImg);
        canvas.setActiveObject(logoImg);
        canvas.renderAll();

        setIsCanvasReady(true);

        // Setup modification handler
        canvas.on('object:modified', (e) => {
          const target = e.target as { data?: { id?: string } } | undefined;
          if (target?.data?.id === 'partner-mall-logo') {
            saveCurrentState();
          }
        });
      })
      .catch((err) => {
        console.error('Error loading logo:', err);
        setIsCanvasReady(true);
      });
  }, [logoUrl, currentProduct.id, currentSide, getProductPlacement, saveCurrentState]);

  // Reset canvas ready state when product changes
  useEffect(() => {
    setIsCanvasReady(false);
    logoRef.current = null;
  }, [currentProduct.id, currentSide?.id]);

  // Navigation handlers
  const goToPrevious = () => {
    saveCurrentState();
    if (currentProductIndex > 0) {
      setCurrentProductIndex(currentProductIndex - 1);
    }
  };

  const goToNext = () => {
    saveCurrentState();
    if (currentProductIndex < products.length - 1) {
      setCurrentProductIndex(currentProductIndex + 1);
    }
  };

  const isFirst = currentProductIndex === 0;
  const isLast = currentProductIndex === products.length - 1;

  const handleConfirm = () => {
    saveCurrentState();
    onConfirm();
  };

  const totalItems = products.length;
  const currentItemIndex = currentProductIndex;

  if (!currentSide) {
    return (
      <div className="bg-white rounded-lg p-6">
        <p className="text-gray-500">제품 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-2">로고 배치 조정</h2>
      <p className="text-gray-600 mb-4">
        로고를 드래그하여 위치를 조정하세요. (앞면만 배치)
      </p>

      {/* Progress indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>
            {currentProduct?.title} - {currentSide?.name || '앞면'}
          </span>
          <span>
            {currentItemIndex + 1} / {totalItems}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${((currentItemIndex + 1) / totalItems) * 100}%` }}
          />
        </div>
      </div>

      {/* Canvas container */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-4 flex justify-center">
        {!isCanvasReady && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}
        <SingleSideCanvas
          key={`${currentProduct.id}-${currentSide.id}`}
          side={currentSide}
          width={canvasWidth}
          height={canvasHeight}
          isEdit={true}
          canvasState={{ objects: [] }}
          onCanvasReady={handleCanvasReady}
        />
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={resetToCenter}
          disabled={!isCanvasReady}
          className="flex items-center gap-2 py-2 px-4 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          중앙으로 초기화
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            disabled={isFirst}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNext}
            disabled={isLast}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          이전
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          미리보기
        </button>
      </div>
    </div>
  );
}
