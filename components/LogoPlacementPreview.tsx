'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { RotateCcw, Move } from 'lucide-react';
import { ProductSide, DefaultLogoPlacement } from '@/types/types';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';

interface LogoPlacementPreviewProps {
  side: ProductSide;
  onPlacementChange: (placement: DefaultLogoPlacement | undefined) => void;
}

export default function LogoPlacementPreview({
  side,
  onPlacementChange,
}: LogoPlacementPreviewProps) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const placeholderRef = useRef<fabric.Rect | null>(null);
  const moveIconRef = useRef<fabric.Text | null>(null);
  const scaleRef = useRef<number>(1);

  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const canvasWidth = 400;
  const canvasHeight = 500;
  const placeholderSize = 60;

  // Update placement from canvas position (stores absolute x,y within print area)
  const updatePlacementFromCanvas = useCallback(() => {
    if (!placeholderRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const placeholder = placeholderRef.current;
    const canvasScale = scaleRef.current;

    // @ts-expect-error - Custom property
    const printAreaLeft = canvas.printAreaLeft || 0;
    // @ts-expect-error - Custom property
    const printAreaTop = canvas.printAreaTop || 0;

    // Get placeholder center position relative to print area origin
    const placeholderCenterX = (placeholder.left || 0) + placeholderSize / 2;
    const placeholderCenterY = (placeholder.top || 0) + placeholderSize / 2;

    // Convert canvas position to absolute position in original image coordinates
    const absoluteX = (placeholderCenterX - printAreaLeft) / canvasScale;
    const absoluteY = (placeholderCenterY - printAreaTop) / canvasScale;

    // Clamp within print area bounds
    const clampedX = Math.max(0, Math.min(side.printArea.width, absoluteX));
    const clampedY = Math.max(0, Math.min(side.printArea.height, absoluteY));

    const newPlacement: DefaultLogoPlacement = {
      x: Math.round(clampedX),
      y: Math.round(clampedY),
      width: side.defaultLogoPlacement?.width ?? 100,
      height: side.defaultLogoPlacement?.height ?? 100,
    };

    onPlacementChange(newPlacement);
  }, [side, onPlacementChange]);

  // Update placeholder position from input values
  const updatePlaceholderFromInputs = useCallback((x: number, y: number) => {
    if (!placeholderRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const placeholder = placeholderRef.current;
    const canvasScale = scaleRef.current;

    // @ts-expect-error - Custom property
    const printAreaLeft = canvas.printAreaLeft || 0;
    // @ts-expect-error - Custom property
    const printAreaTop = canvas.printAreaTop || 0;

    // Convert absolute position to canvas position
    const canvasX = printAreaLeft + x * canvasScale - placeholderSize / 2;
    const canvasY = printAreaTop + y * canvasScale - placeholderSize / 2;

    placeholder.set({ left: canvasX, top: canvasY });

    if (moveIconRef.current) {
      moveIconRef.current.set({
        left: canvasX + placeholderSize / 2,
        top: canvasY + placeholderSize / 2,
      });
    }

    canvas.renderAll();
  }, []);

  // Handle canvas ready callback from SingleSideCanvas
  const handleCanvasReady = useCallback((canvas: fabric.Canvas, _sideId: string, canvasScale: number) => {
    canvasRef.current = canvas;
    scaleRef.current = canvasScale;

    // @ts-expect-error - Custom property
    const printAreaLeft = canvas.printAreaLeft || 0;
    // @ts-expect-error - Custom property
    const printAreaTop = canvas.printAreaTop || 0;

    // Calculate placeholder initial position from existing placement or default to center
    const currentPlacement = side.defaultLogoPlacement;
    const initialX = currentPlacement?.x ?? side.printArea.width / 2;
    const initialY = currentPlacement?.y ?? side.printArea.height / 2;

    // Convert to canvas coordinates
    const placeholderLeft = printAreaLeft + initialX * canvasScale - placeholderSize / 2;
    const placeholderTop = printAreaTop + initialY * canvasScale - placeholderSize / 2;

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
  }, [side.id]);

  // Clear placement
  const clearPlacement = () => {
    onPlacementChange(undefined);
    // Reset placeholder to center
    if (isCanvasReady) {
      updatePlaceholderFromInputs(side.printArea.width / 2, side.printArea.height / 2);
    }
  };

  const currentX = side.defaultLogoPlacement?.x ?? Math.round(side.printArea.width / 2);
  const currentY = side.defaultLogoPlacement?.y ?? Math.round(side.printArea.height / 2);

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden">
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

      {/* Position inputs (absolute x, y within print area) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">X 위치 (px)</label>
          <input
            type="number"
            value={currentX}
            onChange={(e) => {
              const x = parseInt(e.target.value) || 0;
              const clampedX = Math.max(0, Math.min(side.printArea.width, x));
              onPlacementChange({
                x: clampedX,
                y: currentY,
                width: side.defaultLogoPlacement?.width ?? 100,
                height: side.defaultLogoPlacement?.height ?? 100,
              });
              if (isCanvasReady) {
                updatePlaceholderFromInputs(clampedX, currentY);
              }
            }}
            min={0}
            max={side.printArea.width}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <span className="text-xs text-gray-400">최대: {side.printArea.width}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Y 위치 (px)</label>
          <input
            type="number"
            value={currentY}
            onChange={(e) => {
              const y = parseInt(e.target.value) || 0;
              const clampedY = Math.max(0, Math.min(side.printArea.height, y));
              onPlacementChange({
                x: currentX,
                y: clampedY,
                width: side.defaultLogoPlacement?.width ?? 100,
                height: side.defaultLogoPlacement?.height ?? 100,
              });
              if (isCanvasReady) {
                updatePlaceholderFromInputs(currentX, clampedY);
              }
            }}
            min={0}
            max={side.printArea.height}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <span className="text-xs text-gray-400">최대: {side.printArea.height}</span>
        </div>
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
              onPlacementChange({
                x: currentX,
                y: currentY,
                width,
                height: side.defaultLogoPlacement?.height ?? 100,
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
              onPlacementChange({
                x: currentX,
                y: currentY,
                width: side.defaultLogoPlacement?.width ?? 100,
                height,
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
