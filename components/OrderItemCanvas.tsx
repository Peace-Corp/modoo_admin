'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { OrderItem, Product, ProductSide, ObjectDimensions } from '@/types/types';
import { ChevronLeft, Ruler, Grid3x3 } from 'lucide-react';
import SingleSideCanvas from './canvas/SingleSideCanvas';
import { Canvas as FabricCanvas } from 'fabric';

interface OrderItemCanvasProps {
  orderItem: OrderItem;
  onBack: () => void;
}

const parseCanvasState = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Error parsing canvas state:', error);
      return null;
    }
  }
  return value;
};

export default function OrderItemCanvas({ orderItem, onBack }: OrderItemCanvasProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimensionsBySide, setDimensionsBySide] = useState<Record<string, ObjectDimensions[]>>({});
  const [productColors, setProductColors] = useState<Array<{ name: string; hex: string; color_code?: string }>>([]);

  const getItemColorHex = () => {
    const variants = orderItem.item_options?.variants;
    if (Array.isArray(variants) && variants.length > 0 && variants[0]?.color_hex) {
      return variants[0].color_hex;
    }
    return orderItem.item_options?.color_hex || '#FFFFFF';
  };

  const getAppliedProductColorHex = useCallback(() => {
    const canvasStates = Object.values(orderItem.canvas_state || {});
    for (const canvasStateRaw of canvasStates) {
      const canvasState = parseCanvasState(canvasStateRaw);
      if (typeof canvasState?.productColor === 'string' && canvasState.productColor.startsWith('#')) {
        return canvasState.productColor;
      }
    }
    const variants = orderItem.item_options?.variants;
    if (Array.isArray(variants) && variants.length > 0 && variants[0]?.color_hex) {
      return variants[0].color_hex;
    }
    return orderItem.item_options?.color_hex || '#FFFFFF';
  }, [orderItem.canvas_state, orderItem.item_options]);

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

      // Fetch product colors for single-layer products (no colorOptions in config)
      const hasLayerColorOptions = data.configuration.some((side: ProductSide) =>
        side.layers?.some((layer) => Array.isArray(layer.colorOptions) && layer.colorOptions.length > 0)
      );
      if (!hasLayerColorOptions) {
        const colorId = orderItem.item_options?.color_id;
        const appliedColorHex = getAppliedProductColorHex();
        if (appliedColorHex || colorId) {
          fetchProductColors(orderItem.product_id, colorId, appliedColorHex);
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductColors = async (productId: string, colorId?: string, colorHex?: string) => {
    try {
      const supabase = createClient();
      let query = supabase
        .from('product_colors')
        .select('name, hex, color_code')
        .eq('product_id', productId);

      if (colorHex) {
        query = query.ilike('hex', colorHex);
      } else if (colorId) {
        query = query.eq('color_id', colorId);
      }

      const { data, error } = await query.single();

      if (error) throw error;

      if (data) {
        setProductColors([data]);
      }
    } catch (error) {
      console.error('Error fetching product colors:', error);
    }
  };

  const handleCanvasReady = useCallback((canvas: FabricCanvas, sideId: string, canvasScale: number) => {
    // Extract colors and dimensions from the rendered canvas
    const currentSide = product?.configuration.find(s => s.id === sideId);
    if (!currentSide) return;

    const objects = canvas.getObjects();
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

      // Calculate dimensions
      const fill = obj.fill;

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

    setDimensionsBySide(prev => ({ ...prev, [sideId]: dimensions }));
  }, [product]);

  const objectDimensions = useMemo(() => {
    return Object.values(dimensionsBySide).flat();
  }, [dimensionsBySide]);

  // Get selected mockup colors based on whether it's multi-layer or single-layer
  const getMockupColorInfo = useMemo(() => {
    if (!product) return [];

    const hasLayerColorOptions = product.configuration.some((side: ProductSide) =>
      side.layers?.some((layer) => Array.isArray(layer.colorOptions) && layer.colorOptions.length > 0)
    );

    if (hasLayerColorOptions) {
      // Multi-layer product: get colors from canvas_state.layerColors and match with colorCode
      const colors: Array<{ name: string; hex: string; colorCode?: string; label?: string }> = [];

      const addLayerColors = (side: ProductSide, layerColors: Record<string, unknown> | undefined) => {
        if (!layerColors || !side.layers) return 0;
        let added = 0;

        Object.entries(layerColors).forEach(([layerId, colorHex]) => {
          if (typeof colorHex !== 'string' || !colorHex.startsWith('#')) return;
          const layer = side.layers?.find(l => l.id === layerId);
          if (!layer) return;

          const colorOption = layer.colorOptions?.find(
            option => option.hex.toLowerCase() === colorHex.toLowerCase()
          );

          colors.push({
            name: layer.name,
            hex: colorHex,
            colorCode: colorOption?.colorCode,
            label: `${side.name} - ${layer.name}`
          });
          added += 1;
        });

        return added;
      };

      product.configuration.forEach((side: ProductSide) => {
        const canvasStateRaw = orderItem.canvas_state[side.id];
        const canvasState = parseCanvasState(canvasStateRaw);
        addLayerColors(side, canvasState?.layerColors as Record<string, unknown> | undefined);
      });

      if (colors.length === 0 && orderItem.color_selections) {
        product.configuration.forEach((side: ProductSide) => {
          const sideColors = orderItem.color_selections?.[side.id];
          if (sideColors && typeof sideColors === 'object') {
            addLayerColors(side, sideColors as Record<string, unknown>);
          }
        });
      }

      return colors;
    } else {
      // Single-layer product: show the applied mockup filter color
      const appliedColorHex = getAppliedProductColorHex();

      const matchedColor = appliedColorHex
        ? productColors.find(
            color => color.hex.toLowerCase() === appliedColorHex?.toLowerCase()
          )
        : undefined;

      if (matchedColor && appliedColorHex) {
        return [{
          name: matchedColor.name,
          hex: appliedColorHex,
          colorCode: matchedColor.color_code,
          label: undefined
        }];
      }

      if (appliedColorHex) {
        return [{
          name: orderItem.item_options?.color_name || 'Selected Color',
          hex: appliedColorHex,
          colorCode: undefined,
          label: undefined
        }];
      }

      return [];
    }
  }, [getAppliedProductColorHex, orderItem.canvas_state, orderItem.color_selections, product, productColors]);

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

        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
          <Grid3x3 className="w-4 h-4" />
          전체 캔버스 보기
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Canvas Preview */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {product.configuration.map((side) => {
              const canvasState = orderItem.canvas_state[side.id];
              if (!canvasState) return null;

              return (
                <div key={side.id} className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">{side.name}</h3>
                  <div className="flex justify-center items-center bg-gray-50 rounded-lg p-4 min-h-125">
                    <SingleSideCanvas
                      side={side}
                      canvasState={canvasState}
                      productColor={getItemColorHex()}
                      width={400}
                      height={500}
                      onCanvasReady={handleCanvasReady}
                      renderFromCanvasStateOnly
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Colors and Dimensions */}
        <div className="space-y-6">
          {/* Object Information */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Ruler className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">객체 정보</h3>
            </div>
            {getMockupColorInfo.length > 0 ? (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">디자인 색상</p>
                <div className="space-y-2">
                  {getMockupColorInfo.map((color, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg"
                    >
                      <div
                        className="w-10 h-10 rounded border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{color.name}</p>
                        {color.label && (
                          <p className="text-xs text-gray-400">{color.label}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500 font-mono">{color.hex.toUpperCase()}</p>
                          {color.colorCode && (
                            <p className="text-xs text-gray-500 font-mono">({color.colorCode})</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-6">제품 색상 정보가 없습니다.</p>
            )}
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
    </div>
  );
}
