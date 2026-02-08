'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { ChevronLeft, ChevronRight, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Product, ProductSide, LogoPlacement, LogoAnchor } from '@/types/types';
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

// Calculate logo position based on anchor type (relative to print area on canvas)
const getAnchorPosition = (
  anchor: LogoAnchor,
  printAreaWidth: number,
  printAreaHeight: number
): { x: number; y: number } => {
  switch (anchor) {
    case 'left-chest':
      return {
        x: printAreaWidth * 0.15,
        y: printAreaHeight * 0.15,
      };
    case 'right-chest':
      return {
        x: printAreaWidth * 0.65,
        y: printAreaHeight * 0.15,
      };
    case 'center':
    default:
      return {
        x: printAreaWidth / 2,
        y: printAreaHeight / 2,
      };
  }
};

const ANCHOR_LABELS: Record<LogoAnchor, string> = {
  'left-chest': '왼쪽 가슴',
  'right-chest': '오른쪽 가슴',
  'center': '중앙',
};

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
  const printAreaGuideRef = useRef<fabric.Rect | null>(null);
  const scaleRef = useRef<number>(1);

  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [selectedAnchor, setSelectedAnchor] = useState<LogoAnchor>('center');

  const canvasWidth = 400;
  const canvasHeight = 500;

  const currentProduct = products[currentProductIndex];
  // Only use first side (front) of each product
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

  // Helper to get print area values from canvas with fallback calculations
  const getPrintAreaValues = useCallback((canvas: fabric.Canvas, side: ProductSide) => {
    const canvasScale = scaleRef.current;

    // Get print area properties from canvas (set by SingleSideCanvas after image loads)
    // @ts-expect-error - Custom property
    const canvasPrintAreaLeft = canvas.printAreaLeft;
    // @ts-expect-error - Custom property
    const canvasPrintAreaTop = canvas.printAreaTop;
    // @ts-expect-error - Custom property
    const canvasPrintAreaWidth = canvas.printAreaWidth;
    // @ts-expect-error - Custom property
    const canvasPrintAreaHeight = canvas.printAreaHeight;

    // Calculate fallback values if canvas properties aren't set
    const scaledPrintW = side.printArea.width * canvasScale;
    const scaledPrintH = side.printArea.height * canvasScale;
    const scaledPrintX = side.printArea.x * canvasScale;
    const scaledPrintY = side.printArea.y * canvasScale;

    // @ts-expect-error - Custom property
    const originalImageWidth = canvas.originalImageWidth || side.printArea.width * 2;
    // @ts-expect-error - Custom property
    const originalImageHeight = canvas.originalImageHeight || side.printArea.height * 2;

    const imageLeft = (canvasWidth / 2) - (originalImageWidth * canvasScale / 2);
    const imageTop = (canvasHeight / 2) - (originalImageHeight * canvasScale / 2);

    return {
      printAreaLeft: (canvasPrintAreaLeft && canvasPrintAreaLeft > 0) ? canvasPrintAreaLeft : (imageLeft + scaledPrintX),
      printAreaTop: (canvasPrintAreaTop && canvasPrintAreaTop > 0) ? canvasPrintAreaTop : (imageTop + scaledPrintY),
      printAreaWidth: (canvasPrintAreaWidth && canvasPrintAreaWidth > 0) ? canvasPrintAreaWidth : scaledPrintW,
      printAreaHeight: (canvasPrintAreaHeight && canvasPrintAreaHeight > 0) ? canvasPrintAreaHeight : scaledPrintH,
    };
  }, [canvasWidth, canvasHeight]);

  // Save current canvas state
  const saveCurrentState = useCallback(() => {
    if (!canvasRef.current || !logoRef.current || !currentSide) return;

    const canvas = canvasRef.current;
    const logo = logoRef.current;

    const { printAreaLeft, printAreaTop } = getPrintAreaValues(canvas, currentSide);

    // Calculate logo position relative to print area
    const logoLeft = logo.left || 0;
    const logoTop = logo.top || 0;
    const logoWidth = (logo.width || 100) * (logo.scaleX || 1);
    const logoHeight = (logo.height || 100) * (logo.scaleY || 1);

    const placement: LogoPlacement = {
      x: logoLeft - printAreaLeft,
      y: logoTop - printAreaTop,
      width: logoWidth,
      height: logoHeight,
    };

    // Get canvas state (only logo)
    const logoObject = logo.toObject();
    // @ts-expect-error - Include custom data property
    logoObject.data = logo.data;
    const canvasState = {
      objects: [logoObject],
    };

    updatePlacement(currentSide.id, placement, canvasState);
  }, [currentSide, updatePlacement, getPrintAreaValues]);

  // Apply anchor preset to logo position
  const applyAnchorPreset = useCallback((anchor: LogoAnchor) => {
    if (!canvasRef.current || !logoRef.current || !currentSide) return;

    const canvas = canvasRef.current;
    const logo = logoRef.current;

    const { printAreaLeft, printAreaTop, printAreaWidth, printAreaHeight } = getPrintAreaValues(canvas, currentSide);

    const anchorPos = getAnchorPosition(anchor, printAreaWidth, printAreaHeight);

    // Logo size (20% of print area)
    const maxLogoWidth = printAreaWidth * 0.2;
    const maxLogoHeight = printAreaHeight * 0.2;
    const logoScale = Math.min(
      maxLogoWidth / (logo.width || 100),
      maxLogoHeight / (logo.height || 100)
    );

    logo.set({
      left: printAreaLeft + anchorPos.x,
      top: printAreaTop + anchorPos.y,
      scaleX: logoScale,
      scaleY: logoScale,
      angle: 0,
      originX: anchor === 'center' ? 'center' : 'left',
      originY: anchor === 'center' ? 'center' : 'top',
    });

    canvas.renderAll();
    setSelectedAnchor(anchor);
    saveCurrentState();
  }, [currentSide, saveCurrentState, getPrintAreaValues]);

  // Handle canvas ready callback from SingleSideCanvas
  const handleCanvasReady = useCallback((canvas: fabric.Canvas, sideId: string, canvasScale: number) => {
    canvasRef.current = canvas;
    scaleRef.current = canvasScale;

    if (!currentSide) return;

    const { printAreaLeft, printAreaTop, printAreaWidth, printAreaHeight } = getPrintAreaValues(canvas, currentSide);

    // Add print area guide (dashed rectangle)
    const printAreaGuide = new fabric.Rect({
      left: printAreaLeft,
      top: printAreaTop,
      width: printAreaWidth,
      height: printAreaHeight,
      fill: 'transparent',
      stroke: '#3B82F6',
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    canvas.add(printAreaGuide);
    printAreaGuideRef.current = printAreaGuide;

    // Load logo image
    fabric.FabricImage.fromURL(logoUrl, { crossOrigin: 'anonymous' })
      .then((logoImg) => {
        // Check if we have existing placement
        const productPlacement = getProductPlacement(currentProduct.id);
        const existingPlacement = productPlacement.placements[sideId];

        if (existingPlacement) {
          // Use existing placement
          const logoScale = Math.min(
            existingPlacement.width / (logoImg.width || 100),
            existingPlacement.height / (logoImg.height || 100)
          );

          logoImg.set({
            left: printAreaLeft + existingPlacement.x,
            top: printAreaTop + existingPlacement.y,
            scaleX: logoScale,
            scaleY: logoScale,
            originX: 'left',
            originY: 'top',
            data: { id: 'partner-mall-logo' },
          });
        } else {
          // Use center as default
          const anchorPos = getAnchorPosition('center', printAreaWidth, printAreaHeight);

          // Default logo size (20% of print area)
          const maxLogoWidth = printAreaWidth * 0.2;
          const maxLogoHeight = printAreaHeight * 0.2;
          const logoScale = Math.min(
            maxLogoWidth / (logoImg.width || 100),
            maxLogoHeight / (logoImg.height || 100)
          );

          logoImg.set({
            left: printAreaLeft + anchorPos.x,
            top: printAreaTop + anchorPos.y,
            scaleX: logoScale,
            scaleY: logoScale,
            originX: 'center',
            originY: 'center',
            data: { id: 'partner-mall-logo' },
          });

          setSelectedAnchor('center');
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
  }, [logoUrl, currentProduct.id, currentSide, getProductPlacement, saveCurrentState, getPrintAreaValues]);

  // Reset canvas ready state when product changes
  useEffect(() => {
    setIsCanvasReady(false);
    logoRef.current = null;
    printAreaGuideRef.current = null;
  }, [currentProduct.id, currentSide?.id]);

  // Navigation handlers - now only navigating between products (first side only)
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

  // Handle confirm
  const handleConfirm = () => {
    saveCurrentState();
    onConfirm();
  };

  // Total items is now just the number of products (one side per product)
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
        프리셋 위치를 선택하거나 드래그하여 직접 조정하세요. (앞면만 배치)
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

      {/* Anchor preset buttons */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">프리셋 위치</p>
        <div className="flex gap-2">
          {(['left-chest', 'center', 'right-chest'] as LogoAnchor[]).map((anchor) => (
            <button
              key={anchor}
              onClick={() => applyAnchorPreset(anchor)}
              disabled={!isCanvasReady}
              className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                selectedAnchor === anchor
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              {ANCHOR_LABELS[anchor]}
            </button>
          ))}
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
          onClick={() => applyAnchorPreset(selectedAnchor)}
          disabled={!isCanvasReady}
          className="flex items-center gap-2 py-2 px-4 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          위치 초기화
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
