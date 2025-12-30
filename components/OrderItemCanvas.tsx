'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import { OrderItem, Product, ExtractedColor, ObjectDimensions } from '@/types/types';
import { ChevronLeft, Palette, Ruler } from 'lucide-react';
import { Canvas, FabricObject, Image as FabricImage, filters } from 'fabric';

interface OrderItemCanvasProps {
  orderItem: OrderItem;
  onBack: () => void;
}

export default function OrderItemCanvas({ orderItem, onBack }: OrderItemCanvasProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSideIndex, setCurrentSideIndex] = useState(0);
  const [extractedColors, setExtractedColors] = useState<ExtractedColor[]>([]);
  const [objectDimensions, setObjectDimensions] = useState<ObjectDimensions[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    fetchProduct();

    return () => {
      // Cleanup fabric canvas on unmount
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [orderItem.product_id]);

  useEffect(() => {
    if (product) {
      renderCanvas();
    }
  }, [product, currentSideIndex]);

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

  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  const applyColorFilter = (fabricImg: FabricImage, targetColor: string) => {
    const rgb = hexToRgb(targetColor);
    if (!rgb) return;

    // Create a color overlay filter using BlendColor
    const blendFilter = new filters.BlendColor({
      color: targetColor,
      mode: 'multiply',
      alpha: 0.5,
    });

    fabricImg.filters = [blendFilter];
    fabricImg.applyFilters();
  };

  const renderCanvas = async () => {
    if (!product || !canvasRef.current) return;

    const currentSide = product.configuration[currentSideIndex];
    if (!currentSide) return;

    // Dispose existing canvas
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    const sideId = currentSide.id;
    const canvasState = orderItem.canvas_state[sideId];

    try {
      // Load product background image first to get dimensions
      const productImg = await FabricImage.fromURL(currentSide.imageUrl, {
        crossOrigin: 'anonymous',
      });

      // Apply color filter if item has a color selection
      if (orderItem.item_options?.color_hex) {
        applyColorFilter(productImg, orderItem.item_options.color_hex);
      }

      // Calculate canvas size and scaling
      const maxCanvasWidth = 900;
      const maxCanvasHeight = 1100;

      const scale = Math.min(
        maxCanvasWidth / productImg.width!,
        maxCanvasHeight / productImg.height!,
        1 // Don't scale up, only down
      );

      const scaledImgWidth = productImg.width! * scale;
      const scaledImgHeight = productImg.height! * scale;

      // Canvas should have some padding around the image
      const canvasWidth = Math.max(scaledImgWidth, 600);
      const canvasHeight = Math.max(scaledImgHeight, 700);

      // Create fabric canvas
      const fabricCanvas = new Canvas(canvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        selection: false,
        renderOnAddRemove: false,
        backgroundColor: '#f5f5f5',
      });

      fabricCanvasRef.current = fabricCanvas;

      // Scale the background image
      productImg.scale(scale);

      // Center the background image on the canvas
      const imgLeft = (canvasWidth - scaledImgWidth) / 2;
      const imgTop = (canvasHeight - scaledImgHeight) / 2;

      productImg.set({
        left: imgLeft,
        top: imgTop,
      });

      // Set as background
      fabricCanvas.backgroundImage = productImg;

      // If there's canvas state, load the objects
      if (canvasState && canvasState.objects && canvasState.objects.length > 0) {
        // Load from JSON
        await new Promise<void>((resolve, reject) => {
          fabricCanvas.loadFromJSON(canvasState, () => {
            // Get the print area offset
            const printArea = currentSide.printArea;
            const realDimensions = currentSide.realLifeDimensions;

            // Calculate pixel to mm ratio
            let pixelToMmRatio = 1;
            if (realDimensions && realDimensions.printAreaWidthMm > 0 && printArea.width > 0) {
              pixelToMmRatio = realDimensions.printAreaWidthMm / printArea.width;
            }

            // Adjust object positions to account for print area offset
            const objects = fabricCanvas.getObjects();
            const colors: ExtractedColor[] = [];
            const dimensions: ObjectDimensions[] = [];

            objects.forEach((obj: FabricObject) => {
              // Adjust position for centered background and print area
              const adjustedLeft = imgLeft + (obj.left || 0) + printArea.x * scale;
              const adjustedTop = imgTop + (obj.top || 0) + printArea.y * scale;

              obj.set({
                left: adjustedLeft,
                top: adjustedTop,
                selectable: false,
                evented: false,
              });

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
              const objWidth = (obj.width || 0) * (obj.scaleX || 1);
              const objHeight = (obj.height || 0) * (obj.scaleY || 1);

              let objectType = obj.type || 'Object';
              objectType = objectType.charAt(0).toUpperCase() + objectType.slice(1);

              const dimension: ObjectDimensions = {
                objectType,
                widthMm: objWidth * pixelToMmRatio,
                heightMm: objHeight * pixelToMmRatio,
                fill: fill && typeof fill === 'string' && fill !== 'transparent' ? fill : undefined,
              };

              // Add text content for text objects
              if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
                const textObj = obj as any;
                const text = textObj.text || '';
                dimension.text = text.substring(0, 20) + (text.length > 20 ? '...' : '');
              }

              dimensions.push(dimension);
            });

            setExtractedColors(colors);
            setObjectDimensions(dimensions);

            fabricCanvas.renderAll();
            resolve();
          }, (error: Error) => {
            console.error('Error loading canvas from JSON:', error);
            reject(error);
          });
        });
      } else {
        // No objects, just render the background
        fabricCanvas.renderAll();
      }
    } catch (error) {
      console.error('Error rendering canvas:', error);
    }
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
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto border border-gray-200 rounded shadow-sm"
            />
          </div>

          {/* Color filter info */}
          {orderItem.item_options?.color_hex && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">적용된 색상 필터:</span>{' '}
                {orderItem.item_options.color_name} ({orderItem.item_options.color_hex})
              </p>
            </div>
          )}
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
                      <p className="text-xs text-gray-600 mb-1 italic">"{dimension.text}"</p>
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
    </div>
  );
}
