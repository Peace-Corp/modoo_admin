'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { OrderItem, Product, ExtractedColor, ObjectDimensions } from '@/types/types';
import { ChevronLeft, Palette, Ruler, Grid3x3, LayoutGrid } from 'lucide-react';
import { SingleCanvasRenderer } from './OrderCanvasRenderer';
import { Canvas as FabricCanvas } from 'fabric';
import ComprehensiveDesignPreview from './ComprehensiveDesignPreview';

type ViewMode = 'comprehensive' | 'detailed';

interface OrderItemCanvasProps {
  orderItem: OrderItem;
  onBack: () => void;
}

export default function OrderItemCanvas({ orderItem, onBack }: OrderItemCanvasProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('comprehensive');
  const [currentSideIndex, setCurrentSideIndex] = useState(0);
  const [extractedColors, setExtractedColors] = useState<ExtractedColor[]>([]);
  const [objectDimensions, setObjectDimensions] = useState<ObjectDimensions[]>([]);

  useEffect(() => {
    fetchProduct();
  }, [orderItem.product_id]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', orderItem.product_id)
        .single();

      if (error) throw error;

      setProduct(data);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCanvasReady = (canvas: FabricCanvas, sideId: string, canvasScale: number) => {
    // Extract colors and dimensions from the rendered canvas
    const currentSide = product?.configuration.find(s => s.id === sideId);
    if (!currentSide) return;

    const objects = canvas.getObjects();
    const colors: ExtractedColor[] = [];
    const dimensions: ObjectDimensions[] = [];

    const realDimensions = currentSide.realLifeDimensions;
    const printArea = currentSide.printArea;

    let pixelToMmRatio = 1;
    if (realDimensions && realDimensions.printAreaWidthMm > 0 && printArea.width > 0) {
      pixelToMmRatio = realDimensions.printAreaWidthMm / printArea.width;
    }

    objects.forEach((obj) => {
      // Skip the background image
      const objData = obj as { data?: { id?: string } };
      if (objData.data?.id === 'background-product-image') {
        return;
      }

      // Extract colors
      const fill = obj.fill;
      if (fill && typeof fill === 'string' && fill !== 'transparent') {
        if (!colors.find(c => c.hex.toLowerCase() === fill.toLowerCase())) {
          colors.push({ hex: fill });
        }
      }

      const stroke = obj.stroke;
      if (stroke && typeof stroke === 'string') {
        if (!colors.find(c => c.hex.toLowerCase() === stroke.toLowerCase())) {
          colors.push({ hex: stroke });
        }
      }

      // Calculate dimensions
      // The object is scaled on the canvas, so we need to divide by canvasScale
      // to get the original size, then multiply by pixelToMmRatio
      const objWidthOnCanvas = (obj.width || 0) * (obj.scaleX || 1);
      const objHeightOnCanvas = (obj.height || 0) * (obj.scaleY || 1);

      // Convert back to original pixel size (before canvas scaling)
      const objWidthOriginal = objWidthOnCanvas / canvasScale;
      const objHeightOriginal = objHeightOnCanvas / canvasScale;

      let objectType = obj.type || 'Object';
      objectType = objectType.charAt(0).toUpperCase() + objectType.slice(1);

      const dimension: ObjectDimensions = {
        objectType,
        widthMm: objWidthOriginal * pixelToMmRatio,
        heightMm: objHeightOriginal * pixelToMmRatio,
        fill: fill && typeof fill === 'string' && fill !== 'transparent' ? fill : undefined,
      };

      // Add text content for text objects
      if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
        const textObj = obj as { text?: string };
        const text = textObj.text || '';
        dimension.text = text.substring(0, 20) + (text.length > 20 ? '...' : '');
      }

      dimensions.push(dimension);
    });

    setExtractedColors(colors);
    setObjectDimensions(dimensions);
  };

  const getColorName = (hex: string): string => {
    // Simple color name mapping
    const colorNames: Record<string, string> = {
      '#000000': 'Black',
      '#000': 'Black',
      '#ffffff': 'White',
      '#fff': 'White',
      '#ff0000': 'Red',
      '#f00': 'Red',
      '#00ff00': 'Green',
      '#0f0': 'Green',
      '#0000ff': 'Blue',
      '#00f': 'Blue',
      '#ffff00': 'Yellow',
      '#ff0': 'Yellow',
      '#ff00ff': 'Magenta',
      '#f0f': 'Magenta',
      '#00ffff': 'Cyan',
      '#0ff': 'Cyan',
    };

    return colorNames[hex.toLowerCase()] || hex;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">제품 정보를 불러올 수 없습니다.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const currentSide = product.configuration[currentSideIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">디자인 미리보기</h2>
            <p className="text-gray-500 mt-1">{orderItem.product_title}</p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('comprehensive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'comprehensive'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            전체 보기
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'detailed'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid3x3 className="w-4 h-4" />
            상세 보기
          </button>
        </div>
      </div>

      {/* Comprehensive View */}
      {viewMode === 'comprehensive' && (
        <ComprehensiveDesignPreview orderItem={orderItem} product={product} />
      )}

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas Preview */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm">
          {/* Side selector */}
          {product.configuration.length > 1 && (
            <div className="flex gap-2 mb-4 border-b pb-4">
              {product.configuration.map((side, index) => (
                <button
                  key={side.id}
                  onClick={() => setCurrentSideIndex(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentSideIndex === index
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {side.name}
                </button>
              ))}
            </div>
          )}

          {/* Canvas */}
          <div className="flex justify-center items-center bg-gray-50 rounded-lg p-4 min-h-[500px]">
            {currentSide && orderItem.canvas_state[currentSide.id] && (
              <SingleCanvasRenderer
                side={currentSide}
                canvasState={
                  typeof orderItem.canvas_state[currentSide.id] === 'string'
                    ? (orderItem.canvas_state[currentSide.id] as unknown as string)
                    : JSON.stringify(orderItem.canvas_state[currentSide.id])
                }
                productColor={orderItem.item_options?.color_hex || '#FFFFFF'}
                width={400}
                height={500}
                onCanvasReady={handleCanvasReady}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Colors and Dimensions */}
        <div className="space-y-6">
          {/* Extracted Colors */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">디자인 색상</h3>
            </div>
            {extractedColors.length > 0 ? (
              <div className="space-y-2">
                {extractedColors.map((color, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg"
                  >
                    <div
                      className="w-10 h-10 rounded border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{getColorName(color.hex)}</p>
                      <p className="text-xs text-gray-500 font-mono">{color.hex.toUpperCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">디자인에 사용된 색상이 없습니다.</p>
            )}
          </div>

          {/* Object Dimensions */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Ruler className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">객체 크기 (mm)</h3>
            </div>
            {objectDimensions.length > 0 ? (
              <div className="space-y-3">
                {objectDimensions.map((dimension, index) => (
                  <div
                    key={index}
                    className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {dimension.objectType}
                      </span>
                      {dimension.fill && (
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: dimension.fill }}
                        />
                      )}
                    </div>
                    {dimension.text && (
                      <p className="text-xs text-gray-600 mb-1 italic">&quot;{dimension.text}&quot;</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">너비:</span>
                        <span className="ml-1 font-medium text-gray-900">
                          {dimension.widthMm.toFixed(1)} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">높이:</span>
                        <span className="ml-1 font-medium text-gray-900">
                          {dimension.heightMm.toFixed(1)} mm
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">크기 정보가 없습니다.</p>
            )}
          </div>

          {/* Item Options */}
          {orderItem.item_options && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">제품 옵션</h3>
              <div className="space-y-2">
                {orderItem.item_options.color_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">색상:</span>
                    <div className="flex items-center gap-2">
                      {orderItem.item_options.color_hex && (
                        <div
                          className="w-4 h-4 rounded border border-gray-300"
                          style={{ backgroundColor: orderItem.item_options.color_hex }}
                        />
                      )}
                      <span className="font-medium text-gray-900">
                        {orderItem.item_options.color_name}
                      </span>
                    </div>
                  </div>
                )}
                {orderItem.item_options.size_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">사이즈:</span>
                    <span className="font-medium text-gray-900">
                      {orderItem.item_options.size_name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">수량:</span>
                  <span className="font-medium text-gray-900">{orderItem.quantity}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-gray-500">금액:</span>
                  <span className="font-semibold text-gray-900">
                    {(orderItem.price_per_item * orderItem.quantity).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
