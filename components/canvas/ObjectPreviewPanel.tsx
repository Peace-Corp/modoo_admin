'use client'

import React, { useMemo } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ProductSide, PrintMethod } from '@/types/types';
import { Image as ImageIcon, Type, Square } from 'lucide-react';

interface ObjectPreviewPanelProps {
  sides: ProductSide[];
}

interface CanvasObjectInfo {
  objectId: string;
  type: string;
  sideId: string;
  sideName: string;
  widthMm: number;
  heightMm: number;
  printMethod?: PrintMethod;
  preview: string; // Data URL for preview
  object: fabric.FabricObject;
}

const ObjectPreviewPanel: React.FC<ObjectPreviewPanelProps> = ({ sides }) => {
  const { canvasMap, canvasVersion, setObjectPrintMethod, getObjectPrintMethod } = useCanvasStore();

  // Extract all user objects from all canvases
  const allObjects = useMemo(() => {
    const objects: CanvasObjectInfo[] = [];

    console.log('[ObjectPreviewPanel] Extracting objects from canvases...');

    sides.forEach((side) => {
      const canvas = canvasMap[side.id];
      if (!canvas) {
        console.log(`[ObjectPreviewPanel] Canvas not found for side: ${side.id}`);
        return;
      }

      // Get real-world product width from side data
      const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || 500;

      // Get scaled image width from canvas custom properties
      // @ts-expect-error - Custom property
      const scaledImageWidth = canvas.scaledImageWidth;
      // @ts-expect-error - Custom property
      const scaledPrintLeft = canvas.printAreaLeft || 0;
      // @ts-expect-error - Custom property
      const scaledPrintTop = canvas.printAreaTop || 0;

      // Calculate pixel-to-mm ratio
      const pixelToMmRatio = scaledImageWidth ? realWorldProductWidth / scaledImageWidth : 0.25;

      // Filter user objects
      const userObjects = canvas.getObjects().filter(obj => {
        if (obj.excludeFromExport) return false;
        // @ts-expect-error - Checking custom data property
        if (obj.data?.id === 'background-product-image') return false;
        return true;
      });

      console.log(`[ObjectPreviewPanel] Found ${userObjects.length} user objects on ${side.id}`);

      userObjects.forEach((obj) => {
        // @ts-expect-error - Accessing custom data property
        const objectId = obj.data?.objectId;
        if (!objectId) {
          console.warn('[ObjectPreviewPanel] Object missing objectId, skipping:', obj.type);
          return;
        }

        // Get object bounding box
        const boundingRect = obj.getBoundingRect();

        // Calculate size in mm
        const widthMm = boundingRect.width * pixelToMmRatio;
        const heightMm = boundingRect.height * pixelToMmRatio;

        // Get print method
        const printMethod = getObjectPrintMethod(obj);

        // Generate preview by rendering canvas area around the object
        let preview = '';
        try {
          // Get object bounds
          const bounds = obj.getBoundingRect();

          // Add some padding around the object
          const padding = 20;
          const left = Math.max(0, bounds.left - padding);
          const top = Math.max(0, bounds.top - padding);
          const width = bounds.width + (padding * 2);
          const height = bounds.height + (padding * 2);

          // Render the canvas area containing this object
          preview = canvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 1,
            left: left,
            top: top,
            width: width,
            height: height,
          });

          if (preview && preview.length > 100) {
            console.log(`[ObjectPreviewPanel] Generated canvas preview for ${obj.type}`);
          } else {
            console.warn(`[ObjectPreviewPanel] Preview seems empty for ${obj.type}`);
          }
        } catch (error) {
          console.error('[ObjectPreviewPanel] Failed to generate object preview:', error, obj.type);
        }

        objects.push({
          objectId,
          type: obj.type || 'unknown',
          sideId: side.id,
          sideName: side.name,
          widthMm,
          heightMm,
          printMethod: printMethod || undefined,
          preview,
          object: obj,
        });
      });
    });

    console.log(`[ObjectPreviewPanel] Total objects extracted: ${objects.length}`);
    return objects;
  }, [canvasMap, sides, canvasVersion, getObjectPrintMethod]);

  const handlePrintMethodChange = (objectId: string, method: PrintMethod) => {
    setObjectPrintMethod(objectId, method);
  };

  const getObjectIcon = (type: string) => {
    if (type === 'image') return <ImageIcon className="size-4" />;
    if (type === 'i-text' || type === 'text') return <Type className="size-4" />;
    return <Square className="size-4" />;
  };

  const getObjectTypeName = (type: string) => {
    if (type === 'image') return '이미지';
    if (type === 'i-text' || type === 'text') return '텍스트';
    if (type === 'rect') return '사각형';
    if (type === 'circle') return '원형';
    return '오브젝트';
  };

  if (allObjects.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-4 mb-4">
      <h3 className="text-sm font-bold mb-3 text-gray-800">디자인 요소</h3>

      <div className="space-y-3">
        {allObjects.map((objInfo) => {
          console.log(`[ObjectPreviewPanel] Rendering object ${objInfo.type}, has preview: ${!!objInfo.preview}`);
          return (
            <div
              key={objInfo.objectId}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50"
            >
              {/* Object Header */}
              <div className="flex items-start gap-3 mb-2">
                {/* Preview Thumbnail */}
                <div className="w-16 h-16 bg-white border border-gray-200 rounded flex items-center justify-center shrink-0 overflow-hidden">
                  {objInfo.preview ? (
                    <img
                      src={objInfo.preview}
                      alt={getObjectTypeName(objInfo.type)}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        console.error('[ObjectPreviewPanel] Image failed to load for:', objInfo.type);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="text-gray-400">
                      {getObjectIcon(objInfo.type)}
                    </div>
                  )}
                </div>

              {/* Object Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getObjectIcon(objInfo.type)}
                  <span className="text-sm font-semibold text-gray-700">
                    {getObjectTypeName(objInfo.type)}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({objInfo.sideName})
                  </span>
                </div>

                {/* Size Information */}
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">너비:</span>
                    <span>{objInfo.widthMm.toFixed(1)}mm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">높이:</span>
                    <span>{objInfo.heightMm.toFixed(1)}mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Method Selector (only for non-image objects) */}
            {objInfo.type !== 'image' && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">인쇄 방식</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrintMethodChange(objInfo.objectId, 'printing')}
                    className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-all ${
                      objInfo.printMethod === 'printing'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    인쇄
                  </button>
                  <button
                    onClick={() => handlePrintMethodChange(objInfo.objectId, 'embroidery')}
                    className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-all ${
                      objInfo.printMethod === 'embroidery'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    자수
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          총 <span className="font-semibold text-gray-800">{allObjects.length}개</span>의 디자인 요소
        </p>
      </div>
    </div>
  );
};

export default ObjectPreviewPanel;
