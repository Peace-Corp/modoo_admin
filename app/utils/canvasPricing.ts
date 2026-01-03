import type { Canvas, FabricObject } from 'fabric';
import type { ProductSide, PrintMethod } from '@/types/types';

export interface SidePricing {
  sideId: string;
  sideName: string;
  hasObjects: boolean;
  additionalPrice: number;
}

export interface PricingSummary {
  sidePricing: SidePricing[];
  totalAdditionalPrice: number;
}

const DEFAULT_PRODUCT_WIDTH_MM = 500;
const FALLBACK_PIXEL_TO_MM_RATIO = 0.25;

const PRICE_PER_CM2: Record<PrintMethod, number> = {
  printing: 0,
  embroidery: 0,
};

const MINIMUM_SIDE_PRICE = 0;

type CanvasWithScale = Canvas & {
  scaledImageWidth?: number;
};

const getUserObjects = (canvas: Canvas) =>
  canvas.getObjects().filter((obj) => {
    if (obj.excludeFromExport) return false;
    const objData = obj as { data?: { id?: string } };
    if (objData.data?.id === 'background-product-image') return false;
    return true;
  });

const getPixelToMmRatio = (canvas: Canvas, side: ProductSide) => {
  const realWorldProductWidth = side.realLifeDimensions?.productWidthMm || DEFAULT_PRODUCT_WIDTH_MM;
  const scaledImageWidth = (canvas as CanvasWithScale).scaledImageWidth;
  if (scaledImageWidth && scaledImageWidth > 0) {
    return realWorldProductWidth / scaledImageWidth;
  }
  return FALLBACK_PIXEL_TO_MM_RATIO;
};

const getObjectPrintMethod = (obj: FabricObject): PrintMethod => {
  const objData = obj as { data?: { printMethod?: PrintMethod } };
  return objData.data?.printMethod === 'embroidery' ? 'embroidery' : 'printing';
};

const calculateAdditionalPrice = (objects: FabricObject[], pixelToMmRatio: number) => {
  let total = 0;

  objects.forEach((obj) => {
    const bounds = obj.getBoundingRect();
    const areaMm2 = bounds.width * pixelToMmRatio * bounds.height * pixelToMmRatio;
    const areaCm2 = areaMm2 / 100;
    const method = getObjectPrintMethod(obj);
    total += areaCm2 * PRICE_PER_CM2[method];
  });

  if (total <= 0) return 0;
  return Math.max(MINIMUM_SIDE_PRICE, Math.round(total));
};

export function calculateAllSidesPricing(
  canvasMap: Record<string, Canvas>,
  sides: ProductSide[]
): PricingSummary {
  const sidePricing = sides.map((side) => {
    const canvas = canvasMap[side.id];
    if (!canvas) {
      return {
        sideId: side.id,
        sideName: side.name,
        hasObjects: false,
        additionalPrice: 0,
      };
    }

    const objects = getUserObjects(canvas);
    if (objects.length === 0) {
      return {
        sideId: side.id,
        sideName: side.name,
        hasObjects: false,
        additionalPrice: 0,
      };
    }

    const pixelToMmRatio = getPixelToMmRatio(canvas, side);
    const additionalPrice = calculateAdditionalPrice(objects, pixelToMmRatio);

    return {
      sideId: side.id,
      sideName: side.name,
      hasObjects: true,
      additionalPrice,
    };
  });

  const totalAdditionalPrice = sidePricing.reduce(
    (sum, side) => sum + side.additionalPrice,
    0
  );

  return {
    sidePricing,
    totalAdditionalPrice,
  };
}
