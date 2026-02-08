'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { RotateCcw, Move } from 'lucide-react';
import { ProductSide, LogoAnchor, DefaultLogoPlacement } from '@/types/types';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';

interface LogoPlacementPreviewProps {
  side: ProductSide;
  onPlacementChange: (placement: DefaultLogoPlacement | undefined) => void;
}

const ANCHOR_LABELS: Record<LogoAnchor, string> = {
  'left-chest': '왼쪽 가슴',
  'right-chest': '오른쪽 가슴',
  'center': '중앙',
};

// Calculate position based on anchor type (relative to print area)
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
        x: printAreaWidth * 0.5,
        y: printAreaHeight * 0.5,
      };
  }
};

export default function LogoPlacementPreview({
  side,
  onPlacementChange,
}: LogoPlacementPreviewProps) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const placeholderRef = useRef<fabric.Rect | null>(null);
  const moveIconRef = useRef<fabric.Text | null>(null);
  const printAreaGuideRef = useRef<fabric.Rect | null>(null);
  const scaleRef = useRef<number>(1);

  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [selectedAnchor, setSelectedAnchor] = useState<LogoAnchor>(
    side.defaultLogoPlacement?.anchor || 'center'
  );

  const canvasWidth = 400;
  const canvasHeight = 500;
  const placeholderSize = 60; // Visual placeholder size

  // Update placement from canvas position
  const updatePlacementFromCanvas = useCallback(() => {
    if (!placeholderRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const placeholder = placeholderRef.current;
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

    // Use canvas values if valid, otherwise calculate from side config
    const printAreaLeft = (canvasPrintAreaLeft && canvasPrintAreaLeft > 0) ? canvasPrintAreaLeft : (imageLeft + scaledPrintX);
    const printAreaTop = (canvasPrintAreaTop && canvasPrintAreaTop > 0) ? canvasPrintAreaTop : (imageTop + scaledPrintY);
    const printAreaWidth = (canvasPrintAreaWidth && canvasPrintAreaWidth > 0) ? canvasPrintAreaWidth : scaledPrintW;
    const printAreaHeight = (canvasPrintAreaHeight && canvasPrintAreaHeight > 0) ? canvasPrintAreaHeight : scaledPrintH;

    // Get placeholder center position relative to print area
    const placeholderCenterX = (placeholder.left || 0) + placeholderSize / 2;
    const placeholderCenterY = (placeholder.top || 0) + placeholderSize / 2;

    // Convert to relative position within print area (0-1 range)
    const relativeX = (placeholderCenterX - printAreaLeft) / printAreaWidth;
    const relativeY = (placeholderCenterY - printAreaTop) / printAreaHeight;

    // Clamp to valid range
    const clampedX = Math.max(0, Math.min(1, relativeX));
    const clampedY = Math.max(0, Math.min(1, relativeY));

    // Store as percentage of print area
    const newPlacement: DefaultLogoPlacement = {
      x: clampedX * side.printArea.width,
      y: clampedY * side.printArea.height,
      width: side.defaultLogoPlacement?.width ?? 100,
      height: side.defaultLogoPlacement?.height ?? 100,
      anchor: selectedAnchor,
    };

    onPlacementChange(newPlacement);
  }, [side, selectedAnchor, onPlacementChange]);

  // Apply anchor preset
  const applyAnchorPreset = useCallback((anchor: LogoAnchor) => {
    if (!canvasRef.current || !placeholderRef.current) return;

    const canvas = canvasRef.current;
    const placeholder = placeholderRef.current;
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

    // Use canvas values if valid, otherwise calculate from side config
    const printAreaLeft = (canvasPrintAreaLeft && canvasPrintAreaLeft > 0) ? canvasPrintAreaLeft : (imageLeft + scaledPrintX);
    const printAreaTop = (canvasPrintAreaTop && canvasPrintAreaTop > 0) ? canvasPrintAreaTop : (imageTop + scaledPrintY);
    const printAreaWidth = (canvasPrintAreaWidth && canvasPrintAreaWidth > 0) ? canvasPrintAreaWidth : scaledPrintW;
    const printAreaHeight = (canvasPrintAreaHeight && canvasPrintAreaHeight > 0) ? canvasPrintAreaHeight : scaledPrintH;

    const anchorPos = getAnchorPosition(anchor, printAreaWidth, printAreaHeight);

    placeholder.set({
      left: printAreaLeft + anchorPos.x - placeholderSize / 2,
      top: printAreaTop + anchorPos.y - placeholderSize / 2,
    });

    // Update move icon position
    if (moveIconRef.current) {
      moveIconRef.current.set({
        left: printAreaLeft + anchorPos.x,
        top: printAreaTop + anchorPos.y,
      });
    }

    canvas.renderAll();
    setSelectedAnchor(anchor);

    // Update placement
    const newPlacement: DefaultLogoPlacement = {
      x: anchorPos.x / printAreaWidth * side.printArea.width,
      y: anchorPos.y / printAreaHeight * side.printArea.height,
      width: side.defaultLogoPlacement?.width ?? 100,
      height: side.defaultLogoPlacement?.height ?? 100,
      anchor,
    };

    onPlacementChange(newPlacement);
  }, [side, onPlacementChange]);

  // Handle canvas ready callback from SingleSideCanvas
  const handleCanvasReady = useCallback((canvas: fabric.Canvas, _sideId: string, canvasScale: number) => {
    canvasRef.current = canvas;
    scaleRef.current = canvasScale;

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

    // Use canvas values if valid, otherwise calculate from side config
    const printAreaLeft = (canvasPrintAreaLeft && canvasPrintAreaLeft > 0) ? canvasPrintAreaLeft : (imageLeft + scaledPrintX);
    const printAreaTop = (canvasPrintAreaTop && canvasPrintAreaTop > 0) ? canvasPrintAreaTop : (imageTop + scaledPrintY);
    const printAreaWidth = (canvasPrintAreaWidth && canvasPrintAreaWidth > 0) ? canvasPrintAreaWidth : scaledPrintW;
    const printAreaHeight = (canvasPrintAreaHeight && canvasPrintAreaHeight > 0) ? canvasPrintAreaHeight : scaledPrintH;

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

    // Calculate placeholder initial position
    const currentPlacement = side.defaultLogoPlacement;
    let placeholderLeft: number;
    let placeholderTop: number;

    if (currentPlacement) {
      // Use existing placement - convert from original coordinates to canvas coordinates
      const relativeX = currentPlacement.x / side.printArea.width;
      const relativeY = currentPlacement.y / side.printArea.height;
      placeholderLeft = printAreaLeft + relativeX * printAreaWidth - placeholderSize / 2;
      placeholderTop = printAreaTop + relativeY * printAreaHeight - placeholderSize / 2;
    } else {
      // Default to center of print area
      const anchorPos = getAnchorPosition('center', printAreaWidth, printAreaHeight);
      placeholderLeft = printAreaLeft + anchorPos.x - placeholderSize / 2;
      placeholderTop = printAreaTop + anchorPos.y - placeholderSize / 2;
    }

    // Create draggable placeholder
    const placeholder = new fabric.Rect({
      left: placeholderLeft,
      top: placeholderTop,
      width: placeholderSize,
      height: placeholderSize,
      fill: 'rgba(59, 130, 246, 0.3)',
      stroke: '#3B82F6',
      strokeWidth: 2,
      rx: 4,
      ry: 4,
      selectable: true,
      hasControls: false,
      hasBorders: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      data: { id: 'logo-placeholder' },
    });

    placeholderRef.current = placeholder;
    canvas.add(placeholder);

    // Add move icon in center
    const moveIconSize = 20;
    const moveIcon = new fabric.Text('⊕', {
      left: placeholderLeft + placeholderSize / 2,
      top: placeholderTop + placeholderSize / 2,
      fontSize: moveIconSize,
      fill: '#3B82F6',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    canvas.add(moveIcon);
    moveIconRef.current = moveIcon;

    // Update move icon position when placeholder moves
    placeholder.on('moving', () => {
      moveIcon.set({
        left: (placeholder.left || 0) + placeholderSize / 2,
        top: (placeholder.top || 0) + placeholderSize / 2,
      });
    });

    // Handle placeholder modification
    canvas.on('object:modified', (e) => {
      const target = e.target as { data?: { id?: string } } | undefined;
      if (target?.data?.id === 'logo-placeholder') {
        // Update move icon position
        moveIcon.set({
          left: (placeholder.left || 0) + placeholderSize / 2,
          top: (placeholder.top || 0) + placeholderSize / 2,
        });
        canvas.renderAll();
        updatePlacementFromCanvas();
      }
    });

    canvas.renderAll();
    setIsCanvasReady(true);
  }, [side, updatePlacementFromCanvas]);

  // Reset canvas ready state when side changes
  useEffect(() => {
    setIsCanvasReady(false);
    placeholderRef.current = null;
    moveIconRef.current = null;
    printAreaGuideRef.current = null;
    setSelectedAnchor(side.defaultLogoPlacement?.anchor || 'center');
  }, [side.id, side.defaultLogoPlacement?.anchor]);

  // Clear placement
  const clearPlacement = () => {
    onPlacementChange(undefined);
    // Reset to center
    applyAnchorPreset('center');
  };

  return (
    <div className="space-y-4">
      {/* Anchor preset buttons */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">프리셋 위치</p>
        <div className="flex gap-2">
          {(['left-chest', 'center', 'right-chest'] as LogoAnchor[]).map((anchor) => (
            <button
              key={anchor}
              type="button"
              onClick={() => applyAnchorPreset(anchor)}
              disabled={!isCanvasReady}
              className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-colors ${
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

      {/* Canvas */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
        <SingleSideCanvas
          key={side.id}
          side={side}
          width={canvasWidth}
          height={canvasHeight}
          isEdit={true}
          canvasState={{ objects: [] }}
          onCanvasReady={handleCanvasReady}
        />
      </div>

      {/* Instructions */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Move className="w-4 h-4" />
        <span>파란색 사각형을 드래그하여 로고 위치를 조정하세요</span>
      </div>

      {/* Size inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 너비 (px)</label>
          <input
            type="number"
            value={side.defaultLogoPlacement?.width ?? 100}
            onChange={(e) => {
              const width = parseInt(e.target.value) || 100;
              const currentPlacement = side.defaultLogoPlacement;
              onPlacementChange({
                x: currentPlacement?.x ?? side.printArea.width * 0.5,
                y: currentPlacement?.y ?? side.printArea.height * 0.5,
                width,
                height: currentPlacement?.height ?? 100,
                anchor: selectedAnchor,
              });
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 높이 (px)</label>
          <input
            type="number"
            value={side.defaultLogoPlacement?.height ?? 100}
            onChange={(e) => {
              const height = parseInt(e.target.value) || 100;
              const currentPlacement = side.defaultLogoPlacement;
              onPlacementChange({
                x: currentPlacement?.x ?? side.printArea.width * 0.5,
                y: currentPlacement?.y ?? side.printArea.height * 0.5,
                width: currentPlacement?.width ?? 100,
                height,
                anchor: selectedAnchor,
              });
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Clear button */}
      {side.defaultLogoPlacement && (
        <button
          type="button"
          onClick={clearPlacement}
          className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
        >
          <RotateCcw className="w-4 h-4" />
          기본 위치 설정 제거
        </button>
      )}
    </div>
  );
}
