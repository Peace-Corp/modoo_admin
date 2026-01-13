'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Palette, Save } from 'lucide-react';
import { Product, ProductSide, ProductColor, ManufacturerColor } from '@/types/types';
import dynamic from 'next/dynamic';
import { useCanvasStore } from '@/store/useCanvasStore';
import Toolbar from '@/components/canvas/Toolbar';
import LayerColorSelector from '@/components/canvas/LayerColorSelector';
import { saveDesign, SaveDesignData } from '@/lib/designService';
import { serializeCanvasState } from '@/lib/canvasUtils';
import * as fabric from 'fabric';

const SingleSideCanvas = dynamic(() => import('@/components/canvas/SingleSideCanvas'), {
  ssr: false,
  loading: () => <div className="w-[400px] h-[500px] bg-gray-100 animate-pulse" />,
});

interface AdminDesignEditorProps {
  product: Product;
  onDesignSaved: (designId: string) => void;
  onBack: () => void;
}

export default function AdminDesignEditor({ product, onDesignSaved, onBack }: AdminDesignEditorProps) {
  const {
    activeSideId,
    setActiveSide,
    setEditMode,
    isEditMode,
    canvasMap,
    productColor,
    setProductColor,
    layerColors,
    incrementCanvasVersion,
    canvasVersion,
  } = useCanvasStore();

  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [designTitle, setDesignTitle] = useState('');

  const sides: ProductSide[] = product.configuration || [];
  const currentSideIndex = sides.findIndex((s) => s.id === activeSideId);
  const currentSide = sides[currentSideIndex >= 0 ? currentSideIndex : 0];
  const hasLayers = currentSide?.layers && currentSide.layers.length > 0;

  // Fetch product colors
  useEffect(() => {
    const fetchProductColors = async () => {
      try {
        const response = await fetch(`/api/admin/products/colors?productId=${product.id}`);
        if (response.ok) {
          const data = await response.json();
          setProductColors(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching product colors:', error);
      }
    };
    fetchProductColors();
  }, [product.id]);

  // Enable edit mode on mount
  useEffect(() => {
    setEditMode(true);
    return () => {
      setEditMode(false);
    };
  }, [setEditMode]);

  // Set initial active side
  useEffect(() => {
    if (sides.length > 0 && !activeSideId) {
      setActiveSide(sides[0].id);
    }
  }, [sides, activeSideId, setActiveSide]);

  const handleColorSelect = (color: ManufacturerColor) => {
    setProductColor(color.hex);
    incrementCanvasVersion();
    setIsColorPickerOpen(false);
  };

  const handlePrevSide = () => {
    if (currentSideIndex > 0) {
      setActiveSide(sides[currentSideIndex - 1].id);
    }
  };

  const handleNextSide = () => {
    if (currentSideIndex < sides.length - 1) {
      setActiveSide(sides[currentSideIndex + 1].id);
    }
  };

  const generatePreviewImage = async (): Promise<string | undefined> => {
    const canvas = canvasMap[sides[0]?.id];
    if (!canvas) return undefined;

    try {
      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 0.5,
      });
      return dataUrl;
    } catch (error) {
      console.error('Error generating preview:', error);
      return undefined;
    }
  };

  const handleSaveDesign = async () => {
    if (!designTitle.trim()) {
      alert('디자인 제목을 입력해주세요.');
      return;
    }

    setIsSaving(true);

    try {
      // Serialize canvas state from all sides
      const canvasState: Record<string, string> = {};
      for (const side of sides) {
        const canvas = canvasMap[side.id];
        if (canvas) {
          canvasState[side.id] = serializeCanvasState(canvas, layerColors[side.id] || {});
        }
      }

      // Generate preview image
      const previewImage = await generatePreviewImage();

      // Save the design
      const designData: SaveDesignData = {
        productId: product.id,
        title: designTitle,
        productColor,
        canvasState,
        previewImage,
        pricePerItem: product.base_price,
      };

      const savedDesign = await saveDesign(designData);

      if (savedDesign) {
        onDesignSaved(savedDesign.id);
      } else {
        alert('디자인 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving design:', error);
      alert('디자인 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b bg-gray-50">
        <Toolbar sides={sides} handleExitEditMode={() => {}} variant="desktop" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 p-6">
          {/* Side navigation */}
          {sides.length > 1 && (
            <div className="mb-4 flex items-center gap-4">
              <button
                onClick={handlePrevSide}
                disabled={currentSideIndex <= 0}
                className="p-2 rounded-full bg-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-2">
                {sides.map((side, index) => (
                  <button
                    key={side.id}
                    onClick={() => setActiveSide(side.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      index === currentSideIndex
                        ? 'bg-black text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {side.name}
                  </button>
                ))}
              </div>
              <button
                onClick={handleNextSide}
                disabled={currentSideIndex >= sides.length - 1}
                className="p-2 rounded-full bg-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Canvas */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {currentSide && (
              <SingleSideCanvas
                side={currentSide}
                width={400}
                height={500}
                isEdit={isEditMode}
                productColor={productColor}
              />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 bg-white border-l flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-900 mb-3">제품 색상</h3>
            {hasLayers && currentSide?.layers ? (
              <LayerColorSelector sideId={activeSideId || ''} layers={currentSide.layers} />
            ) : (
              <div className="relative">
                <button
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  className="w-full p-3 border rounded-lg flex items-center gap-3 hover:bg-gray-50"
                >
                  <div
                    className="w-8 h-8 rounded-full border-2 border-gray-200"
                    style={{ backgroundColor: productColor }}
                  />
                  <span className="text-sm text-gray-700">
                    {productColors.find(pc => pc.manufacturer_colors?.hex === productColor)?.manufacturer_colors?.name || '색상 선택'}
                  </span>
                  <Palette className="w-4 h-4 text-gray-400 ml-auto" />
                </button>

                {isColorPickerOpen && productColors.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-10 p-3 max-h-60 overflow-auto">
                    <div className="grid grid-cols-5 gap-2">
                      {productColors.map((pc) => {
                        const color = pc.manufacturer_colors;
                        if (!color) return null;
                        return (
                          <button
                            key={pc.id}
                            onClick={() => handleColorSelect(color)}
                            className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                              productColor === color.hex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Design title input */}
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-900 mb-3">디자인 제목</h3>
            <input
              type="text"
              value={designTitle}
              onChange={(e) => setDesignTitle(e.target.value)}
              placeholder="디자인 제목 입력"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Save button */}
          <div className="p-4 mt-auto">
            <button
              onClick={handleSaveDesign}
              disabled={isSaving || !designTitle.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5" />
                  다음 단계로
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
