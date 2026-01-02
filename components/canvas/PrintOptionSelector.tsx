'use client'

import React from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { PrintMethod } from '@/types/types';

interface PrintOptionSelectorProps {
  selectedObject: fabric.FabricObject;
}

const PrintOptionSelector: React.FC<PrintOptionSelectorProps> = ({ selectedObject }) => {
  const { setObjectPrintMethod, getObjectPrintMethod } = useCanvasStore();

  // Get the object's unique ID
  // @ts-expect-error - Accessing custom data property
  const objectId = selectedObject?.data?.objectId;

  // Get current print method
  const currentMethod = getObjectPrintMethod(selectedObject);

  // Don't show for image objects
  if (selectedObject.type === 'image') {
    return null;
  }

  const handleMethodChange = (method: PrintMethod) => {
    if (objectId) {
      setObjectPrintMethod(objectId, method);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
      <h3 className="text-sm font-semibold mb-3 text-gray-700">인쇄 방식 선택</h3>

      <div className="flex gap-2">
        {/* Printing Option */}
        <button
          onClick={() => handleMethodChange('printing')}
          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
            currentMethod === 'printing'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="text-center">
            <div className="font-semibold text-sm">인쇄</div>
            <div className="text-xs text-gray-500 mt-1">Printing</div>
          </div>
        </button>

        {/* Embroidery Option */}
        <button
          onClick={() => handleMethodChange('embroidery')}
          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
            currentMethod === 'embroidery'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="text-center">
            <div className="font-semibold text-sm">자수</div>
            <div className="text-xs text-gray-500 mt-1">Embroidery</div>
          </div>
        </button>
      </div>

      {/* Info text */}
      <div className="mt-3 text-xs text-gray-500">
        {currentMethod === 'embroidery' ? (
          <p>자수는 고급스러운 느낌을 주며 내구성이 뛰어납니다.</p>
        ) : (
          <p>인쇄는 다양한 색상과 디테일한 표현이 가능합니다.</p>
        )}
      </div>
    </div>
  );
};

export default PrintOptionSelector;
