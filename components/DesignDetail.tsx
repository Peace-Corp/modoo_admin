'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { SavedDesign, Product, ProductSide, CanvasState, CustomFont } from '@/types/types';
import { ChevronLeft, Palette, User, Calendar, Package, Grid3x3 } from 'lucide-react';
import SingleSideCanvas from './canvas/SingleSideCanvas';
import { useCanvasStore } from '@/store/useCanvasStore';

interface DesignDetailProps {
  design: SavedDesign;
  onBack: () => void;
}

const parseCanvasState = (value: unknown): CanvasState | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Error parsing canvas state:', error);
      return null;
    }
  }
  return value as CanvasState;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseJsonValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Error parsing JSON value:', error);
    return null;
  }
};

const coerceCustomFonts = (value: unknown): CustomFont[] => {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];

  const fonts: CustomFont[] = [];
  parsed.forEach((raw) => {
    if (!isPlainRecord(raw)) return;
    const fontFamily = typeof raw.fontFamily === 'string' ? raw.fontFamily : '';
    const url = typeof raw.url === 'string' ? raw.url : '';
    if (!fontFamily || !url) return;
    fonts.push({
      fontFamily,
      fileName: typeof raw.fileName === 'string' ? raw.fileName : `${fontFamily}.ttf`,
      url,
      path: typeof raw.path === 'string' ? raw.path : undefined,
      uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : undefined,
      format: typeof raw.format === 'string' ? raw.format : undefined,
    });
  });

  return fonts;
};

export default function DesignDetail({ design, onBack }: DesignDetailProps) {
  // All useState hooks first
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [productColors, setProductColors] = useState<Array<{ name: string; hex: string; color_code?: string }>>([]);

  // Get store functions
  const { setLayerColor, setProductColor } = useCanvasStore();

  // All useMemo hooks
  const customFonts = useMemo(() => coerceCustomFonts(design.custom_fonts), [design.custom_fonts]);

  // All useCallback hooks
  const getAppliedProductColorHex = useCallback(() => {
    const canvasStates = Object.values(design.canvas_state || {});
    for (const canvasStateRaw of canvasStates) {
      const canvasState = parseCanvasState(canvasStateRaw);
      if (typeof canvasState?.productColor === 'string' && canvasState.productColor.startsWith('#')) {
        return canvasState.productColor;
      }
    }
    return '#FFFFFF';
  }, [design.canvas_state]);

  const fetchProductColors = useCallback(async (productId: string, colorHex?: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('product_colors')
        .select(`
          id,
          manufacturer_color_id,
          manufacturer_colors (
            id,
            name,
            hex,
            color_code
          )
        `)
        .eq('product_id', productId)
        .eq('is_active', true);

      if (error) throw error;

      if (data && data.length > 0) {
        type ManufacturerColor = { id: string; name: string; hex: string; color_code?: string };
        let matchedColor: ManufacturerColor | null = null;

        for (const item of data) {
          const mc = item.manufacturer_colors as unknown as ManufacturerColor | null;
          if (!mc) continue;

          if (colorHex && mc.hex.toLowerCase() === colorHex.toLowerCase()) {
            matchedColor = mc;
            break;
          }
        }

        if (!matchedColor && data[0]?.manufacturer_colors) {
          matchedColor = data[0].manufacturer_colors as unknown as ManufacturerColor;
        }

        if (matchedColor) {
          setProductColors([{
            name: matchedColor.name,
            hex: matchedColor.hex,
            color_code: matchedColor.color_code,
          }]);
        }
      }
    } catch (error) {
      console.error('Error fetching product colors:', error);
    }
  }, []);

  // All useEffect hooks
  useEffect(() => {
    let isMounted = true;

    const fetchProduct = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', design.product_id)
          .single();

        if (error) throw error;
        if (!isMounted) return;

        setProduct(data);

        // Fetch product colors for single-layer products
        const hasLayerColorOptions = data.configuration.some((side: ProductSide) =>
          side.layers?.some((layer) => Array.isArray(layer.colorOptions) && layer.colorOptions.length > 0)
        );

        if (!hasLayerColorOptions) {
          const canvasStates = Object.values(design.canvas_state || {});
          let appliedColorHex = '#FFFFFF';
          for (const canvasStateRaw of canvasStates) {
            const canvasState = parseCanvasState(canvasStateRaw);
            if (typeof canvasState?.productColor === 'string' && canvasState.productColor.startsWith('#')) {
              appliedColorHex = canvasState.productColor;
              break;
            }
          }
          if (appliedColorHex && appliedColorHex !== '#FFFFFF') {
            fetchProductColors(design.product_id, appliedColorHex);
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [design.product_id, design.canvas_state, fetchProductColors]);

  // Effect to initialize layer colors from the saved design
  useEffect(() => {
    if (!product) return;

    // Initialize product color for single-layer products
    const appliedColor = getAppliedProductColorHex();
    if (appliedColor && appliedColor !== '#FFFFFF') {
      setProductColor(appliedColor);
    }

    // Initialize layer colors for multi-layer products
    product.configuration.forEach((side) => {
      // First check canvasState.layerColors
      const canvasStateRaw = design.canvas_state[side.id];
      const canvasState = parseCanvasState(canvasStateRaw);

      if (canvasState?.layerColors && typeof canvasState.layerColors === 'object') {
        Object.entries(canvasState.layerColors).forEach(([layerId, colorHex]) => {
          if (typeof colorHex === 'string' && colorHex.startsWith('#')) {
            setLayerColor(side.id, layerId, colorHex);
          }
        });
      }

      // Then check color_selections as fallback
      const sideColorSelections = design.color_selections?.[side.id];
      if (sideColorSelections && typeof sideColorSelections === 'object') {
        Object.entries(sideColorSelections).forEach(([layerId, colorHex]) => {
          if (typeof colorHex === 'string' && colorHex.startsWith('#')) {
            // Only set if not already set from canvasState
            if (!canvasState?.layerColors?.[layerId]) {
              setLayerColor(side.id, layerId, colorHex);
            }
          }
        });
      }
    });
  }, [product, design.canvas_state, design.color_selections, setLayerColor, setProductColor, getAppliedProductColorHex]);

  // Get selected mockup colors based on whether it's multi-layer or single-layer
  const getMockupColorInfo = useMemo(() => {
    if (!product) return [];

    const hasLayerColorOptions = product.configuration.some((side: ProductSide) =>
      side.layers?.some((layer) => Array.isArray(layer.colorOptions) && layer.colorOptions.length > 0)
    );

    if (hasLayerColorOptions) {
      // Multi-layer product: get colors from canvas_state.layerColors
      const colorsMap = new Map<
        string,
        { name: string; hex: string; colorCode?: string; labelParts: Set<string> }
      >();

      const addLayerColors = (side: ProductSide, layerColors: Record<string, unknown> | undefined) => {
        if (!layerColors || !side.layers) return;

        Object.entries(layerColors).forEach(([layerId, colorHex]) => {
          if (typeof colorHex !== 'string' || !colorHex.startsWith('#')) return;
          const layer = side.layers?.find(l => l.id === layerId);
          if (!layer) return;

          const colorOption = layer.colorOptions?.find(
            option => option.hex.toLowerCase() === colorHex.toLowerCase()
          );

          const existing = colorsMap.get(layer.id);
          if (existing && existing.hex.toLowerCase() === colorHex.toLowerCase()) {
            existing.labelParts.add(side.name);
            return;
          }

          if (existing) {
            existing.labelParts.add(side.name);
            return;
          }

          colorsMap.set(layer.id, {
            name: layer.name,
            hex: colorHex,
            colorCode: colorOption?.colorCode,
            labelParts: new Set([side.name]),
          });
        });
      };

      product.configuration.forEach((side: ProductSide) => {
        const canvasStateRaw = design.canvas_state[side.id];
        const canvasState = parseCanvasState(canvasStateRaw);
        addLayerColors(side, canvasState?.layerColors as Record<string, unknown> | undefined);
      });

      if (colorsMap.size === 0 && design.color_selections) {
        product.configuration.forEach((side: ProductSide) => {
          const sideColors = design.color_selections?.[side.id];
          if (sideColors && typeof sideColors === 'object') {
            addLayerColors(side, sideColors as Record<string, unknown>);
          }
        });
      }

      return Array.from(colorsMap.values()).map((entry) => ({
        name: entry.name,
        hex: entry.hex,
        colorCode: entry.colorCode,
        label: Array.from(entry.labelParts).join(', '),
      }));
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

      if (appliedColorHex && appliedColorHex !== '#FFFFFF') {
        return [{
          name: 'Selected Color',
          hex: appliedColorHex,
          colorCode: undefined,
          label: undefined
        }];
      }

      return [];
    }
  }, [getAppliedProductColorHex, design.canvas_state, design.color_selections, product, productColors]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          className="mt-4 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {design.title || '제목 없는 디자인'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{product.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-md">
          <Grid3x3 className="w-4 h-4" />
          전체 캔버스 보기
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Canvas Preview */}
        <div className="lg:col-span-2 bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {product.configuration.map((side) => {
              const canvasState = design.canvas_state[side.id] as CanvasState | string | null;
              if (!canvasState) return null;

              return (
                <div key={side.id} className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">{side.name}</h3>
                  <div className="flex justify-center items-center bg-gray-50 rounded-md p-3 min-h-125">
                    <SingleSideCanvas
                      side={side}
                      canvasState={canvasState}
                      productColor={getAppliedProductColorHex()}
                      width={400}
                      height={500}
                      renderFromCanvasStateOnly
                      customFonts={customFonts}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Design Info */}
        <div className="space-y-4">
          {/* Design Information */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-5 h-5 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-900">디자인 정보</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 shrink-0 w-16">제목:</span>
                <span className="text-sm font-medium text-gray-900">
                  {design.title || '제목 없음'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 shrink-0 w-16">ID:</span>
                <span className="text-sm font-mono text-gray-600 break-all">
                  {design.id}
                </span>
              </div>
              {design.price_per_item > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-500 shrink-0 w-16">가격:</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {design.price_per_item.toLocaleString()}원
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* User Information */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-900">사용자 정보</h3>
            </div>
            <div className="space-y-2">
              {design.user?.email && (
                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-500 shrink-0 w-16">이메일:</span>
                  <span className="text-sm text-gray-900 break-all">{design.user.email}</span>
                </div>
              )}
              {design.user?.name && (
                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-500 shrink-0 w-16">이름:</span>
                  <span className="text-sm text-gray-900">{design.user.name}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 shrink-0 w-16">사용자 ID:</span>
                <span className="text-sm font-mono text-gray-600 break-all">{design.user_id}</span>
              </div>
            </div>
          </div>

          {/* Product Information */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-900">제품 정보</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 shrink-0 w-16">제품명:</span>
                <span className="text-sm font-medium text-gray-900">{product.title}</span>
              </div>
              {product.product_code && (
                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-500 shrink-0 w-16">코드:</span>
                  <span className="text-sm font-mono text-gray-600">{product.product_code}</span>
                </div>
              )}
            </div>
          </div>

          {/* Design Colors */}
          {getMockupColorInfo.length > 0 && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-5 h-5 text-gray-600" />
                <h3 className="text-base font-semibold text-gray-900">디자인 색상</h3>
              </div>
              <div className="space-y-2">
                {getMockupColorInfo.map((color, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 border border-gray-200 rounded-md"
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
                      {color.colorCode && (
                        <p className="text-xs text-gray-500 font-mono">{color.colorCode}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-900">날짜 정보</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 shrink-0 w-16">생성일:</span>
                <span className="text-sm text-gray-900">{formatDate(design.created_at)}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 shrink-0 w-16">수정일:</span>
                <span className="text-sm text-gray-900">{formatDate(design.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Custom Fonts */}
          {customFonts.length > 0 && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
                <h3 className="text-base font-semibold text-gray-900">커스텀 폰트</h3>
              </div>
              <div className="space-y-2">
                {customFonts.map((font, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border border-gray-200 rounded-md bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {font.fontFamily}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {font.fileName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
