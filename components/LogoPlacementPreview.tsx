'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { RotateCcw, Move } from 'lucide-react';
import { ProductSide, LogoPlacement } from '@/types/types';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';

interface LogoPlacementPreviewProps {
  sides: ProductSide[];
  placement: LogoPlacement | null;
  onPlacementChange: (placement: LogoPlacement) => void;
}

const DEFAULT_PLACEMENT: LogoPlacement = {
  x: 50,
  y: 50,
  width: 100,
  height: 100,
};

export default function LogoPlacementPreview({
  sides,
  placement,
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

  const frontSide = sides.length > 0 ? sides[0] : null;

  const currentX = placement?.x ?? DEFAULT_PLACEMENT.x;
  const currentY = placement?.y ?? DEFAULT_PLACEMENT.y;
  const currentWidth = placement?.width ?? DEFAULT_PLACEMENT.width;
  const currentHeight = placement?.height ?? DEFAULT_PLACEMENT.height;

  const updatePlacementFromCanvas = useCallback(() => {
    if (!placeholderRef.current || !canvasRef.current || !frontSide) return;

    const canvas = canvasRef.current;
    const placeholder = placeholderRef.current;
    const canvasScale = scaleRef.current;

    // @ts-expect-error - Custom property
    const printAreaLeft = canvas.printAreaLeft || 0;
    // @ts-expect-error - Custom property
    const printAreaTop = canvas.printAreaTop || 0;

    const placeholderCenterX = (placeholder.left || 0) + placeholderSize / 2;
    const placeholderCenterY = (placeholder.top || 0) + placeholderSize / 2;

    const absoluteX = (placeholderCenterX - printAreaLeft) / canvasScale;
    const absoluteY = (placeholderCenterY - printAreaTop) / canvasScale;

    const clampedX = Math.max(0, Math.min(frontSide.printArea.width, absoluteX));
    const clampedY = Math.max(0, Math.min(frontSide.printArea.height, absoluteY));

    onPlacementChange({
      x: Math.round(clampedX),
      y: Math.round(clampedY),
      width: currentWidth,
      height: currentHeight,
    });
  }, [frontSide, onPlacementChange, currentWidth, currentHeight]);

  const updatePlaceholderFromInputs = useCallback((x: number, y: number) => {
    if (!placeholderRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const placeholder = placeholderRef.current;
    const canvasScale = scaleRef.current;

    // @ts-expect-error - Custom property
    const printAreaLeft = canvas.printAreaLeft || 0;
    // @ts-expect-error - Custom property
    const printAreaTop = canvas.printAreaTop || 0;

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

  const handleCanvasReady = useCallback((canvas: fabric.Canvas, _sideId: string, canvasScale: number) => {
    if (!frontSide) return;

    canvasRef.current = canvas;
    scaleRef.current = canvasScale;

    // @ts-expect-error - Custom property
    const printAreaLeft = canvas.printAreaLeft || 0;
    // @ts-expect-error - Custom property
    const printAreaTop = canvas.printAreaTop || 0;

    const initialX = placement?.x ?? DEFAULT_PLACEMENT.x;
    const initialY = placement?.y ?? DEFAULT_PLACEMENT.y;

    const placeholderLeft = printAreaLeft + initialX * canvasScale - placeholderSize / 2;
    const placeholderTop = printAreaTop + initialY * canvasScale - placeholderSize / 2;

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

    const moveIconSize = 20;
    const moveIcon = new fabric.Text('\u2295', {
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

    placeholder.on('moving', () => {
      moveIcon.set({
        left: (placeholder.left || 0) + placeholderSize / 2,
        top: (placeholder.top || 0) + placeholderSize / 2,
      });
    });

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
  }, [frontSide, placement, updatePlacementFromCanvas]);

  useEffect(() => {
    setIsCanvasReady(false);
    placeholderRef.current = null;
    moveIconRef.current = null;
  }, [frontSide?.id]);

  const resetToDefault = () => {
    if (!frontSide) return;

    onPlacementChange({
      x: DEFAULT_PLACEMENT.x,
      y: DEFAULT_PLACEMENT.y,
      width: currentWidth,
      height: currentHeight,
    });

    if (isCanvasReady) {
      updatePlaceholderFromInputs(DEFAULT_PLACEMENT.x, DEFAULT_PLACEMENT.y);
    }
  };

  if (!frontSide) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
        <p className="text-gray-500">면을 먼저 추가해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900">로고 배치 위치</h4>
          <p className="text-sm text-gray-500">앞면 기본 로고 배치 위치</p>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-gray-200">
        <SingleSideCanvas
          key={frontSide.id}
          side={frontSide}
          width={canvasWidth}
          height={canvasHeight}
          isEdit={true}
          canvasState={{ objects: [] }}
          onCanvasReady={handleCanvasReady}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Move className="w-4 h-4" />
        <span>파란색 사각형을 드래그하여 로고 위치를 조정하세요</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">X 위치 (px)</label>
          <input
            type="number"
            value={currentX}
            onChange={(e) => {
              const x = parseInt(e.target.value) || 0;
              const clampedX = Math.max(0, Math.min(frontSide.printArea.width, x));
              onPlacementChange({ x: clampedX, y: currentY, width: currentWidth, height: currentHeight });
              if (isCanvasReady) {
                updatePlaceholderFromInputs(clampedX, currentY);
              }
            }}
            min={0}
            max={frontSide.printArea.width}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <span className="text-xs text-gray-400">최대: {frontSide.printArea.width}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Y 위치 (px)</label>
          <input
            type="number"
            value={currentY}
            onChange={(e) => {
              const y = parseInt(e.target.value) || 0;
              const clampedY = Math.max(0, Math.min(frontSide.printArea.height, y));
              onPlacementChange({ x: currentX, y: clampedY, width: currentWidth, height: currentHeight });
              if (isCanvasReady) {
                updatePlaceholderFromInputs(currentX, clampedY);
              }
            }}
            min={0}
            max={frontSide.printArea.height}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <span className="text-xs text-gray-400">최대: {frontSide.printArea.height}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 너비 (px)</label>
          <input
            type="number"
            value={currentWidth}
            onChange={(e) => {
              const width = parseInt(e.target.value) || DEFAULT_PLACEMENT.width;
              onPlacementChange({ x: currentX, y: currentY, width, height: currentHeight });
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 높이 (px)</label>
          <input
            type="number"
            value={currentHeight}
            onChange={(e) => {
              const height = parseInt(e.target.value) || DEFAULT_PLACEMENT.height;
              onPlacementChange({ x: currentX, y: currentY, width: currentWidth, height });
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={resetToDefault}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <RotateCcw className="w-4 h-4" />
        기본 위치로 초기화
      </button>
    </div>
  );
}
