'use client';

import { useState, useMemo, useCallback } from 'react';
import { Package, Palette, Ruler, Download, Type, ImageIcon } from 'lucide-react';
import {
  Product,
  ProductSide,
  ProductColor,
  OrderItem,
  ObjectDimensions,
  CanvasState,
  CustomFont,
} from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import {
  parseCanvasState,
  normalizeColorToHex,
  coerceImageUrlsBySide,
  coerceTextSvgExports,
  coerceTextSvgObjectUrlsBySide,
  coerceCustomFonts,
  getTextSvgFromCanvasState,
  getFileExtensionFromName,
  getFileExtensionFromUrl,
  getFileExtensionFromType,
  buildFilename,
  sanitizeFilenameSegment,
  isTextObjectType,
  getPrintMethodName,
  getPrintMethodColor,
  downloadBlob,
  downloadDataUrl,
  downloadUrl,
  sleep,
  ImageUrlsBySide,
  TextSvgObjectUrlsBySide,
} from '@/lib/downloadUtils';

interface OrderModePanelProps {
  product: Product;
  orderItem: OrderItem;
  productColors: ProductColor[];
}

export default function OrderModePanel({
  product,
  orderItem,
  productColors,
}: OrderModePanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { canvasMap, canvasVersion } = useCanvasStore();

  const imageUrlsBySide = useMemo(() => coerceImageUrlsBySide(orderItem.image_urls), [orderItem.image_urls]);
  const customFonts = useMemo(() => coerceCustomFonts(orderItem.custom_fonts), [orderItem.custom_fonts]);

  const textSvgExports = useMemo(() => coerceTextSvgExports(orderItem.text_svg_exports), [orderItem.text_svg_exports]);
  const textSvgSideUrls = useMemo(() => {
    const result: Record<string, string> = {};
    Object.entries(textSvgExports).forEach(([sideId, value]) => {
      if (sideId === '__objects') return;
      if (typeof value !== 'string' || !value) return;
      result[sideId] = value;
    });
    return result;
  }, [textSvgExports]);
  const textSvgObjectUrlsBySide = useMemo(() => {
    return coerceTextSvgObjectUrlsBySide(textSvgExports.__objects);
  }, [textSvgExports]);

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

  // Compute object dimensions from canvas state
  const objectDimensions = useMemo(() => {
    const dimensions: ObjectDimensions[] = [];
    const sides = product.configuration || [];

    for (const side of sides) {
      const canvasStateRaw = orderItem.canvas_state?.[side.id];
      const canvasState = parseCanvasState(canvasStateRaw);
      if (!canvasState || !Array.isArray(canvasState.objects)) continue;

      const realDimensions = side.realLifeDimensions;
      const printArea = side.printArea;
      let pixelToMmRatio = 1;
      if (realDimensions && realDimensions.printAreaWidthMm > 0 && printArea.width > 0) {
        pixelToMmRatio = realDimensions.printAreaWidthMm / printArea.width;
      }

      for (const obj of canvasState.objects) {
        if (!obj || typeof obj !== 'object') continue;
        if (obj.data?.id === 'background-product-image') continue;

        const objectId = obj.data?.objectId || obj.objectId;
        const printMethod = obj.data?.printMethod || obj.printMethod;

        const colors: string[] = [];
        const addColor = (v: unknown) => {
          if (typeof v !== 'string') return;
          const normalized = normalizeColorToHex(v);
          if (normalized && !colors.includes(normalized)) colors.push(normalized);
        };
        addColor(obj.fill);
        addColor(obj.stroke);

        const objWidth = (obj.width || 0) * (obj.scaleX || 1);
        const objHeight = (obj.height || 0) * (obj.scaleY || 1);

        const widthMm = typeof obj.data?.widthMm === 'number'
          ? obj.data.widthMm
          : typeof obj.widthMm === 'number'
          ? obj.widthMm
          : objWidth * pixelToMmRatio;

        const heightMm = typeof obj.data?.heightMm === 'number'
          ? obj.data.heightMm
          : typeof obj.heightMm === 'number'
          ? obj.heightMm
          : objHeight * pixelToMmRatio;

        let objectType = obj.type || 'Object';
        objectType = objectType.charAt(0).toUpperCase() + objectType.slice(1);

        const dimension: ObjectDimensions = {
          objectId,
          sideId: side.id,
          rawType: obj.type,
          objectType,
          widthMm,
          heightMm,
          fill: obj.fill && typeof obj.fill === 'string' && obj.fill !== 'transparent' ? obj.fill : undefined,
          colors: colors.length > 0 ? colors : undefined,
          printMethod: printMethod as ObjectDimensions['printMethod'],
        };

        const typeLower = (obj.type || '').toLowerCase();
        if (isTextObjectType(typeLower)) {
          const text = obj.text || '';
          dimension.text = text.substring(0, 30) + (text.length > 30 ? '...' : '');
          dimension.fontFamily = obj.fontFamily;
          dimension.fontSize = obj.fontSize;
          dimension.fontWeight = obj.fontWeight;
          dimension.fontStyle = obj.fontStyle;
          dimension.textAlign = obj.textAlign;
          dimension.lineHeight = obj.lineHeight;
          if (typeLower === 'curvedtext' && typeof obj.curveIntensity === 'number') {
            dimension.curveIntensity = obj.curveIntensity;
          }
        }

        dimensions.push(dimension);
      }
    }

    return dimensions;
  }, [product, orderItem.canvas_state]);

  // Generate object previews from live canvas using per-object toDataURL
  const objectPreviews = useMemo(() => {
    const previews: Record<string, string> = {};
    const sides = product.configuration || [];

    for (const side of sides) {
      const canvas = canvasMap[side.id];
      if (!canvas) continue;

      const objects = canvas.getObjects().filter((obj) => {
        if (obj.excludeFromExport) return false;
        const d = obj as { data?: { id?: string; objectId?: string } };
        if (d.data?.id === 'background-product-image') return false;
        return true;
      });

      for (const obj of objects) {
        const d = obj as { data?: { objectId?: string } };
        const objectId = d.data?.objectId;
        if (!objectId) continue;

        try {
          previews[objectId] = obj.toDataURL({
            format: 'png',
            quality: 0.9,
            multiplier: 1,
          });
        } catch {
          // skip
        }
      }
    }

    return previews;
    // canvasVersion triggers regeneration when objects finish loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMap, product.configuration, canvasVersion]);

  const mockupColorInfo = useMemo(() => {
    if (!product) return [];
    const appliedColorHex = getAppliedProductColorHex();
    if (appliedColorHex) {
      // Try to find matching manufacturer color from productColors for richer data
      const matchingPc = productColors.find(
        (pc) => pc.manufacturer_colors?.hex === appliedColorHex
      );
      const mc = matchingPc?.manufacturer_colors;
      const colorName = mc?.name || orderItem.item_options?.variants?.[0]?.color_name || orderItem.item_options?.color_name || 'Selected Color';
      const colorCode = mc?.color_code || orderItem.item_options?.variants?.[0]?.color_code || orderItem.item_options?.color_code;
      const colorLabel = mc?.label;
      return [{ name: colorName, hex: appliedColorHex, colorCode, colorLabel }];
    }
    return [];
  }, [product, productColors, getAppliedProductColorHex, orderItem.item_options]);

  interface SizeOptionObj { label: string; size_code: string }
  const rawSizeOptions = (product?.size_options ?? []) as (string | SizeOptionObj)[];
  const sizeOptions: SizeOptionObj[] = rawSizeOptions.map((opt) =>
    typeof opt === 'string' ? { label: opt, size_code: opt } : opt
  );

  const sizeQuantities = useMemo(() => {
    const map = new Map<string, number>();
    if (!sizeOptions.length) return map;

    const findSizeOption = (sizeId?: string, sizeName?: string) => {
      if (sizeId) {
        const byCode = sizeOptions.find((opt) => opt.size_code.toLowerCase() === sizeId.toLowerCase());
        if (byCode) return byCode;
      }
      if (sizeName) {
        const byLabel = sizeOptions.find((opt) => opt.label.toLowerCase() === sizeName.toLowerCase());
        if (byLabel) return byLabel;
      }
      const fallbackLabel = sizeName || sizeId || 'unknown';
      return { label: fallbackLabel, size_code: sizeId || fallbackLabel };
    };

    const addQty = (sizeId?: string, sizeName?: string, quantity?: number) => {
      if (!quantity || quantity <= 0) return;
      const opt = findSizeOption(sizeId, sizeName);
      if (!opt) return;
      map.set(opt.size_code, (map.get(opt.size_code) || 0) + quantity);
    };

    const variants = orderItem.item_options?.variants ?? [];
    if (variants.length > 0) {
      variants.forEach((v) => addQty(v.size_id, v.size_name, v.quantity));
    } else {
      addQty(orderItem.item_options?.size_id, orderItem.item_options?.size_name, orderItem.quantity);
    }

    return map;
  }, [orderItem.item_options, orderItem.quantity, sizeOptions]);

  // Download helpers
  const findTextSvgUrlForObject = (objectId: string, preferredSideId?: string | null) => {
    if (preferredSideId && textSvgObjectUrlsBySide[preferredSideId]?.[objectId]) {
      return { sideId: preferredSideId, url: textSvgObjectUrlsBySide[preferredSideId][objectId] };
    }
    for (const [sideId, objectMap] of Object.entries(textSvgObjectUrlsBySide)) {
      const url = objectMap?.[objectId];
      if (url) return { sideId, url };
    }
    return null;
  };

  const findCanvasObjectByObjectId = (objectId: string) => {
    const canvasStates = orderItem.canvas_state || {};
    for (const [sideId, sideStateRaw] of Object.entries(canvasStates)) {
      const canvasState = parseCanvasState(sideStateRaw);
      const objects = Array.isArray(canvasState?.objects) ? canvasState.objects : [];
      for (const rawObject of objects) {
        if (!rawObject || typeof rawObject !== 'object') continue;
        const id = rawObject.data?.objectId || rawObject.objectId;
        if (id !== objectId) continue;
        return { sideId, src: rawObject.src, type: rawObject.type, data: rawObject.data };
      }
    }
    return null;
  };

  const handleDownloadObjectAsset = async (dimension: ObjectDimensions, index: number) => {
    const objectId = dimension.objectId;
    const safeObjectId = objectId ? sanitizeFilenameSegment(objectId) : String(index + 1);
    const resolvedSideId = dimension.sideId;
    const rawType = (dimension.rawType || dimension.objectType || '').toLowerCase();
    const basePrefix = `order-${orderItem.id}`;

    try {
      if (objectId && isTextObjectType(rawType)) {
        const svgAsset = findTextSvgUrlForObject(objectId, resolvedSideId);
        if (svgAsset?.url) {
          await downloadUrl(svgAsset.url, `${basePrefix}-${svgAsset.sideId}-text-${safeObjectId}.svg`);
          return;
        }
        if (resolvedSideId && textSvgSideUrls[resolvedSideId]) {
          await downloadUrl(textSvgSideUrls[resolvedSideId], `${basePrefix}-${resolvedSideId}-text.svg`);
          return;
        }
        if (resolvedSideId) {
          const cs = parseCanvasState(orderItem.canvas_state?.[resolvedSideId]);
          if (cs?.objects?.length) {
            const filtered = cs.objects.find((o) => {
              if (!o || typeof o !== 'object') return false;
              const t = typeof o.type === 'string' ? o.type.toLowerCase() : '';
              if (!isTextObjectType(t)) return false;
              return (o.data?.objectId || o.objectId) === objectId;
            });
            if (filtered) {
              const svg = getTextSvgFromCanvasState({ ...cs, objects: [filtered] }, resolvedSideId);
              if (svg) {
                downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${basePrefix}-${resolvedSideId}-text-${safeObjectId}.svg`);
                return;
              }
            }
          }
        }
      }

      if (objectId && rawType === 'image') {
        const canvasObject = findCanvasObjectByObjectId(objectId);
        const sideId = resolvedSideId || canvasObject?.sideId;
        const data = canvasObject?.data;
        const trackedSideImages = sideId ? imageUrlsBySide[sideId] : undefined;

        const supabaseUrl = typeof data?.supabaseUrl === 'string' ? data.supabaseUrl : undefined;
        const supabasePath = typeof data?.supabasePath === 'string' ? data.supabasePath : undefined;
        const originalFileUrl = typeof data?.originalFileUrl === 'string' ? data.originalFileUrl : undefined;
        const src = typeof canvasObject?.src === 'string' ? canvasObject.src : undefined;

        let urlToDownload = supabaseUrl || originalFileUrl || src;
        if (trackedSideImages?.length) {
          const trackedIndex = trackedSideImages.findIndex((img) => {
            if (supabaseUrl && img.url === supabaseUrl) return true;
            if (supabasePath && img.path === supabasePath) return true;
            return false;
          });
          if (trackedIndex >= 0) {
            urlToDownload = trackedSideImages[trackedIndex].url;
          } else if (trackedSideImages.length === 1 && !supabaseUrl && !supabasePath) {
            urlToDownload = trackedSideImages[0].url;
          }
        }

        if (urlToDownload) {
          const ext = getFileExtensionFromName(data?.originalFileName) || getFileExtensionFromUrl(urlToDownload) || getFileExtensionFromType(data?.fileType) || 'png';
          const filename = buildFilename(`${basePrefix}-${sideId || 'image'}-image-${safeObjectId}`, ext);
          if (urlToDownload.startsWith('data:')) {
            await downloadDataUrl(urlToDownload, filename);
          } else {
            await downloadUrl(urlToDownload, filename);
          }
          return;
        }
      }

      alert('다운로드 가능한 에셋을 찾지 못했습니다.');
    } catch (error) {
      console.error('Error downloading object asset:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadFont = async (font: CustomFont) => {
    const ext = font.format || getFileExtensionFromUrl(font.url) || 'ttf';
    const filename = buildFilename(`font-${sanitizeFilenameSegment(font.fontFamily)}`, ext);
    await downloadUrl(font.url, filename);
  };

  return (
    <>
      {/* Size/Quantity Table */}
      {sizeOptions.length > 0 && (
        <div className="p-3 border-b">
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">주문 옵션</h3>
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-gray-50 text-black">
                <tr>
                  {sizeOptions.map((size) => (
                    <th key={size.size_code} className="px-2 py-1.5 text-center font-medium border border-gray-200">
                      <div>{size.label}</div>
                      {size.size_code && size.size_code !== size.label && (
                        <div className="text-[9px] font-normal text-gray-400 font-mono">{size.size_code}</div>
                      )}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center font-medium border border-gray-200 bg-gray-100">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-black">
                <tr>
                  {sizeOptions.map((size) => {
                    const quantity = sizeQuantities.get(size.size_code);
                    return (
                      <td key={size.size_code} className="px-2 py-1.5 text-center border border-gray-200">
                        {quantity && quantity > 0 ? <span className="font-semibold">{quantity}</span> : '-'}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center border border-gray-200 bg-gray-100 font-bold">
                    {Array.from(sizeQuantities.values()).reduce((sum, qty) => sum + qty, 0) || '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Info + Color */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-1.5 mb-2">
          <Package className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">제품 정보</h3>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-start gap-1.5">
            <span className="text-[11px] text-gray-400 shrink-0 w-12">제품명</span>
            <span className="text-[11px] font-medium text-gray-800">{product.title}</span>
          </div>
          {product.product_code && (
            <div className="flex items-start gap-1.5">
              <span className="text-[11px] text-gray-400 shrink-0 w-12">코드</span>
              <span className="text-[11px] font-medium text-gray-800 font-mono">{product.product_code}</span>
            </div>
          )}
          {product.manufacturers?.name && (
            <div className="flex items-start gap-1.5">
              <span className="text-[11px] text-gray-400 shrink-0 w-12">제조사</span>
              <span className="text-[11px] font-medium text-gray-800">{product.manufacturers.name}</span>
            </div>
          )}
          {/* Color inline */}
          {mockupColorInfo.length > 0 && mockupColorInfo.map((color, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[11px] text-gray-400 shrink-0 w-12 mt-0.5">원감</span>
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full border border-gray-300 shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-800">{color.name}</span>
                  <div className="flex items-center gap-1.5">
                    {color.colorCode && (
                      <span className="text-[10px] font-medium text-gray-500 font-mono">{color.colorCode}</span>
                    )}
                    <span className="text-[10px] text-gray-400 font-mono">{color.hex}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Design Specifications */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Ruler className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">디자인 사양</h3>
        </div>
        {objectDimensions.length > 0 ? (
          <div className="space-y-3">
            {(product.configuration || []).map((side) => {
              const sideObjects = objectDimensions.filter((d) => d.sideId === side.id);
              if (sideObjects.length === 0) return null;
              return (
                <div key={side.id}>
                  <div className="text-[11px] font-bold text-gray-700 mb-2 pb-1 border-b border-gray-100">[{side.name}]</div>
                  <div className="space-y-3">
                    {sideObjects.map((dim, index) => {
                      const preview = dim.objectId ? objectPreviews[dim.objectId] : undefined;
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg bg-gray-50/50 overflow-hidden">
                          {/* Preview image */}
                          <div className="w-full aspect-square bg-white flex items-center justify-center p-3 border-b border-gray-100">
                            {preview ? (
                              <img
                                src={preview}
                                alt={dim.text || dim.objectType}
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <div className="text-gray-300">
                                {isTextObjectType((dim.rawType || '').toLowerCase()) ? (
                                  <Type className="w-10 h-10" />
                                ) : (
                                  <ImageIcon className="w-10 h-10" />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Object details */}
                          <div className="p-2.5">
                            <div className="flex items-start justify-between mb-1.5">
                              <span className="text-[11px] font-semibold text-gray-800 leading-tight">
                                {dim.text || dim.objectType}
                              </span>
                              <button
                                onClick={() => void handleDownloadObjectAsset(dim, objectDimensions.indexOf(dim))}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0 ml-1"
                              >
                                <Download className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <div className="space-y-0.5 text-[10px]">
                              <div className="flex gap-1">
                                <span className="text-gray-400 shrink-0 w-7">방식</span>
                                <span className={`font-medium px-1 rounded ${getPrintMethodColor(dim.printMethod)}`}>
                                  {getPrintMethodName(dim.printMethod)}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <span className="text-gray-400 shrink-0 w-7">크기</span>
                                <span className="text-gray-700">
                                  {dim.widthMm >= dim.heightMm
                                    ? `가로기준 ${(dim.widthMm / 10).toFixed(1)}cm`
                                    : `세로기준 ${(dim.heightMm / 10).toFixed(1)}cm`}
                                </span>
                              </div>
                              {dim.colors && dim.colors.length > 0 && (
                                <div className="flex gap-1 items-center">
                                  <span className="text-gray-400 shrink-0 w-7">색상</span>
                                  <div className="flex flex-wrap gap-1">
                                    {dim.colors.map((c) => (
                                      <span key={c} className="inline-flex items-center gap-0.5">
                                        <span className="w-2.5 h-2.5 rounded-sm border border-gray-300" style={{ backgroundColor: c }} />
                                        <span className="font-mono text-gray-500">{c}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {dim.fontFamily && (
                                <div className="flex gap-1">
                                  <span className="text-gray-400 shrink-0 w-7">폰트</span>
                                  <span className="text-gray-700 truncate">{dim.fontFamily}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">객체 정보가 없습니다.</p>
        )}
      </div>

      {/* Custom Fonts */}
      {customFonts.length > 0 && (
        <div className="p-3 border-b">
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">커스텀 폰트</h3>
          <div className="space-y-1">
            {customFonts.map((font, i) => (
              <div key={i} className="flex items-center justify-between p-1.5 border border-gray-200 rounded bg-gray-50/50">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-800 truncate">{font.fontFamily}</p>
                  <p className="text-[10px] text-gray-400 truncate">{font.fileName}</p>
                </div>
                <button
                  onClick={() => void handleDownloadFont(font)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded transition-colors ml-2"
                >
                  <Download className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
