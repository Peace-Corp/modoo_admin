'use client';

import { create } from 'zustand';
import * as fabric from 'fabric';
import type { ProductLayer, PrintMethod } from '@/types/types';

interface TextExportResult {
  svg: string;
  textObjects: fabric.FabricObject[];
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface CanvasStore {
  canvasMap: Record<string, fabric.Canvas>;
  activeSideId: string | null;
  isEditMode: boolean;
  productColor: string;
  layerColors: Record<string, Record<string, string>>;
  canvasVersion: number;
  zoomLevels: Record<string, number>;
  objectPrintMethods: Record<string, PrintMethod>;

  registerCanvas: (sideId: string, canvas: fabric.Canvas) => void;
  unregisterCanvas: (sideId: string) => void;
  setActiveSide: (sideId: string) => void;
  getActiveCanvas: () => fabric.Canvas | null;
  setEditMode: (isEditMode: boolean) => void;
  setProductColor: (color: string) => void;
  markImageLoaded: (sideId: string) => void;
  incrementCanvasVersion: () => void;
  initializeLayerColors: (sideId: string, layers: ProductLayer[]) => void;
  setLayerColor: (sideId: string, layerId: string, color: string) => void;
  resetZoom: (sideId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getZoomLevel: () => number;
  setObjectPrintMethod: (objectId: string, method: PrintMethod) => void;
  getObjectPrintMethod: (obj?: fabric.FabricObject | null) => PrintMethod | null;
  getCanvasColors: (sensitivity: number) => Promise<{ colors: string[]; count: number }>;
  exportTextToSVG: () => TextExportResult | null;
  exportAndUploadTextToSVG: () => Promise<
    | {
        svg?: string;
        textObjects: fabric.FabricObject[];
        uploadResult?: UploadResult;
      }
    | null
  >;
  exportAndUploadAllTextToSVG: () => Promise<
    Record<
      string,
      {
        svg?: string;
        textObjects: fabric.FabricObject[];
        uploadResult?: UploadResult;
      }
    >
  >;
}

const isHexColor = (value: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

const normalizeHexColor = (value: string): string | null => {
  const trimmed = value.trim();
  if (isHexColor(trimmed)) {
    if (trimmed.length === 4) {
      return (
        '#' +
        trimmed
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      ).toLowerCase();
    }
    return trimmed.toLowerCase();
  }

  const rgbMatch = trimmed.match(/^rgb\s*\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  if (!rgbMatch) return null;

  const toHex = (value: string) => {
    const num = Math.max(0, Math.min(255, Number(value)));
    return num.toString(16).padStart(2, '0');
  };

  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`.toLowerCase();
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const intVal = parseInt(normalized.slice(1), 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
};

const colorDistance = (a: string, b: string) => {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return Number.MAX_SAFE_INTEGER;
  const dr = rgbA.r - rgbB.r;
  const dg = rgbA.g - rgbB.g;
  const db = rgbA.b - rgbB.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const getTextObjectsFromCanvas = (canvas: fabric.Canvas) =>
  canvas
    .getObjects()
    .filter((obj) => {
      if (obj.excludeFromExport) return false;
      const objData = obj as { data?: { id?: string } };
      if (objData.data?.id === 'background-product-image') return false;
      return obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox';
    });

const exportCanvasTextToSvg = (canvas: fabric.Canvas): TextExportResult | null => {
  const textObjects = getTextObjectsFromCanvas(canvas);
  if (textObjects.length === 0) return null;

  const visibilityMap = new Map<fabric.FabricObject, boolean>();
  canvas.getObjects().forEach((obj) => {
    visibilityMap.set(obj, obj.visible ?? true);
    if (!textObjects.includes(obj)) {
      obj.visible = false;
    }
  });

  const svg = canvas.toSVG();

  canvas.getObjects().forEach((obj) => {
    const wasVisible = visibilityMap.get(obj);
    if (typeof wasVisible === 'boolean') {
      obj.visible = wasVisible;
    }
  });

  return { svg, textObjects };
};

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  canvasMap: {},
  activeSideId: null,
  isEditMode: false,
  productColor: '#FFFFFF',
  layerColors: {},
  canvasVersion: 0,
  zoomLevels: {},
  objectPrintMethods: {},

  registerCanvas: (sideId, canvas) =>
    set((state) => {
      const canvasMap = { ...state.canvasMap, [sideId]: canvas };
      const activeSideId = state.activeSideId ?? sideId;
      return { canvasMap, activeSideId };
    }),

  unregisterCanvas: (sideId) =>
    set((state) => {
      const canvasMap = { ...state.canvasMap };
      delete canvasMap[sideId];

      const zoomLevels = { ...state.zoomLevels };
      delete zoomLevels[sideId];

      const layerColors = { ...state.layerColors };
      delete layerColors[sideId];

      const activeSideId =
        state.activeSideId === sideId
          ? Object.keys(canvasMap)[0] || null
          : state.activeSideId;

      return { canvasMap, zoomLevels, layerColors, activeSideId };
    }),

  setActiveSide: (sideId) => set({ activeSideId: sideId }),

  getActiveCanvas: () => {
    const { canvasMap, activeSideId } = get();
    return activeSideId ? canvasMap[activeSideId] || null : null;
  },

  setEditMode: (isEditMode) => set({ isEditMode }),

  setProductColor: (color) => set({ productColor: color }),

  markImageLoaded: () => set((state) => ({ canvasVersion: state.canvasVersion + 1 })),

  incrementCanvasVersion: () => set((state) => ({ canvasVersion: state.canvasVersion + 1 })),

  initializeLayerColors: (sideId, layers) =>
    set((state) => {
      const existing = state.layerColors[sideId] || {};
      const next = { ...existing };
      layers.forEach((layer) => {
        if (!next[layer.id]) {
          next[layer.id] = layer.colorOptions?.[0]?.hex || '#FFFFFF';
        }
      });
      return { layerColors: { ...state.layerColors, [sideId]: next } };
    }),

  setLayerColor: (sideId, layerId, color) =>
    set((state) => ({
      layerColors: {
        ...state.layerColors,
        [sideId]: {
          ...(state.layerColors[sideId] || {}),
          [layerId]: color,
        },
      },
    })),

  resetZoom: (sideId) =>
    set((state) => {
      const canvas = state.canvasMap[sideId];
      if (!canvas) return state;

      // Reset zoom centered on canvas center
      const center = new fabric.Point(canvas.width! / 2, canvas.height! / 2);
      canvas.zoomToPoint(center, 1);
      canvas.requestRenderAll();
      return {
        zoomLevels: {
          ...state.zoomLevels,
          [sideId]: 1,
        },
      };
    }),

  zoomIn: () => {
    const { getActiveCanvas, zoomLevels, activeSideId } = get();
    const canvas = getActiveCanvas();
    if (!canvas || !activeSideId) return;

    const currentZoom = zoomLevels[activeSideId] || canvas.getZoom() || 1;
    const nextZoom = Math.min(currentZoom + 0.1, 5);

    // Get canvas center point and zoom to center
    const center = new fabric.Point(canvas.width! / 2, canvas.height! / 2);
    canvas.zoomToPoint(center, nextZoom);
    canvas.requestRenderAll();

    set((state) => ({
      zoomLevels: {
        ...state.zoomLevels,
        [activeSideId]: nextZoom,
      },
    }));
  },

  zoomOut: () => {
    const { getActiveCanvas, zoomLevels, activeSideId } = get();
    const canvas = getActiveCanvas();
    if (!canvas || !activeSideId) return;

    const currentZoom = zoomLevels[activeSideId] || canvas.getZoom() || 1;
    const nextZoom = Math.max(currentZoom - 0.1, 0.2);

    // Get canvas center point and zoom to center
    const center = new fabric.Point(canvas.width! / 2, canvas.height! / 2);
    canvas.zoomToPoint(center, nextZoom);
    canvas.requestRenderAll();

    set((state) => ({
      zoomLevels: {
        ...state.zoomLevels,
        [activeSideId]: nextZoom,
      },
    }));
  },

  getZoomLevel: () => {
    const { activeSideId, zoomLevels } = get();
    if (!activeSideId) return 1;
    return zoomLevels[activeSideId] || 1;
  },

  setObjectPrintMethod: (objectId, method) =>
    set((state) => ({
      objectPrintMethods: {
        ...state.objectPrintMethods,
        [objectId]: method,
      },
    })),

  getObjectPrintMethod: (obj) => {
    if (!obj) return null;
    const objData = obj as { data?: { objectId?: string; printMethod?: PrintMethod } };
    if (objData.data?.printMethod) return objData.data.printMethod;
    const objectId = objData.data?.objectId;
    return objectId ? get().objectPrintMethods[objectId] || null : null;
  },

  getCanvasColors: async (sensitivity) => {
    const { canvasMap } = get();
    const colors: string[] = [];

    Object.values(canvasMap).forEach((canvas) => {
      canvas.getObjects().forEach((obj) => {
        if (obj.excludeFromExport) return;
        const objData = obj as { data?: { id?: string } };
        if (objData.data?.id === 'background-product-image') return;

        const fill = typeof obj.fill === 'string' ? normalizeHexColor(obj.fill) : null;
        const stroke = typeof obj.stroke === 'string' ? normalizeHexColor(obj.stroke) : null;
        if (fill) colors.push(fill);
        if (stroke) colors.push(stroke);
      });
    });

    if (colors.length === 0) {
      return { colors: [], count: 0 };
    }

    const threshold = (Math.max(0, Math.min(100, sensitivity)) / 100) * 120;
    const merged: string[] = [];

    colors.forEach((color) => {
      const existing = merged.find((candidate) => colorDistance(candidate, color) <= threshold);
      if (!existing) {
        merged.push(color);
      }
    });

    return { colors: merged, count: merged.length };
  },

  exportTextToSVG: () => {
    const canvas = get().getActiveCanvas();
    if (!canvas) return null;
    return exportCanvasTextToSvg(canvas);
  },

  exportAndUploadTextToSVG: async () => {
    const canvas = get().getActiveCanvas();
    if (!canvas) return null;

    const exportResult = exportCanvasTextToSvg(canvas);
    if (!exportResult) return null;

    return {
      svg: exportResult.svg,
      textObjects: exportResult.textObjects,
      uploadResult: {
        success: false,
        error: 'SVG upload is not configured in this project.',
      },
    };
  },

  exportAndUploadAllTextToSVG: async () => {
    const { canvasMap } = get();
    const results: Record<string, { svg?: string; textObjects: fabric.FabricObject[]; uploadResult?: UploadResult }> = {};

    Object.entries(canvasMap).forEach(([sideId, canvas]) => {
      const exportResult = exportCanvasTextToSvg(canvas);
      if (!exportResult) {
        results[sideId] = { textObjects: [] };
        return;
      }

      results[sideId] = {
        svg: exportResult.svg,
        textObjects: exportResult.textObjects,
        uploadResult: {
          success: false,
          error: 'SVG upload is not configured in this project.',
        },
      };
    });

    return results;
  },
}));
