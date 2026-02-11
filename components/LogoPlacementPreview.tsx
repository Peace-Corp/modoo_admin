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

  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const canvasWidth = 400;
  const canvasHeight = 500;
  const placeholderSize = 60;

  const frontSide = sides.length > 0 ? sides[0] : null;

  const currentX = placement?.x ?? DEFAULT_PLACEMENT.x;
  const currentY = placement?.y ?? DEFAULT_PLACEMENT.y;
  const currentWidth = placement?.width ?? DEFAULT_PLACEMENT.width;
  const currentHeight = placement?.height ?? DEFAULT_PLACEMENT.height;

  // Read placement directly from canvas coordinates
  const updatePlacementFromCanvas = useCallback(() => {
    if (!placeholderRef.current || !canvasRef.current) return;

    const placeholder = placeholderRef.current;

    onPlacementChange({
      x: Math.round(placeholder.left || 0),
      y: Math.round(placeholder.top || 0),
      width: currentWidth,
      height: currentHeight,
    });
  }, [onPlacementChange, currentWidth, currentHeight]);

  // Set placeholder position directly from coordinate values
  const updatePlaceholderFromInputs = useCallback((x: number, y: number) => {
    if (!placeholderRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const placeholder = placeholderRef.current;

    placeholder.set({ left: x, top: y });

    if (moveIconRef.current) {
      moveIconRef.current.set({
        left: x + placeholderSize / 2,
        top: y + placeholderSize / 2,
      });
    }

    canvas.renderAll();
  }, []);

  const handleCanvasReady = useCallback((canvas: fabric.Canvas, _sideId: string, _canvasScale: number) => {
    if (!frontSide) return;

    canvasRef.current = canvas;

    const initialX = placement?.x ?? DEFAULT_PLACEMENT.x;
    const initialY = placement?.y ?? DEFAULT_PLACEMENT.y;

    const placeholder = new fabric.Rect({
      left: initialX,
      top: initialY,
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
      left: initialX + placeholderSize / 2,
      top: initialY + placeholderSize / 2,
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
          showScaleBox={false}
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
              const x = Math.max(0, Math.min(canvasWidth, parseInt(e.target.value) || 0));
              onPlacementChange({ x, y: currentY, width: currentWidth, height: currentHeight });
              if (isCanvasReady) {
                updatePlaceholderFromInputs(x, currentY);
              }
            }}
            min={0}
            max={canvasWidth}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <span className="text-xs text-gray-400">최대: {canvasWidth}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Y 위치 (px)</label>
          <input
            type="number"
            value={currentY}
            onChange={(e) => {
              const y = Math.max(0, Math.min(canvasHeight, parseInt(e.target.value) || 0));
              onPlacementChange({ x: currentX, y, width: currentWidth, height: currentHeight });
              if (isCanvasReady) {
                updatePlaceholderFromInputs(currentX, y);
              }
            }}
            min={0}
            max={canvasHeight}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
          <span className="text-xs text-gray-400">최대: {canvasHeight}</span>
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
