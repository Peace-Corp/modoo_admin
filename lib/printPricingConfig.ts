import { PrintPricingConfig, PrintSize, PrintMethod } from '@/types/types';

/**
 * Map legacy print method names to new ones
 * This handles objects that were created with old method names
 */
const LEGACY_METHOD_MAP: Record<string, PrintMethod> = {
  'printing': 'dtf',      // Old 'printing' maps to DTF
  'embroidery': 'embroidery',
  'dtf': 'dtf',
  'dtg': 'dtg',
  'screen_printing': 'screen_printing',
  'applique': 'applique',
};

/**
 * Normalize print method name from legacy to new format
 * Returns null if the method is invalid
 */
export function normalizePrintMethod(method: string | undefined | null): PrintMethod | null {
  if (!method) return null;
  return LEGACY_METHOD_MAP[method] || null;
}

/**
 * Default print pricing configuration
 * Admin can modify these values through the admin panel
 */
export const DEFAULT_PRINT_PRICING: PrintPricingConfig = {
  dtf: {
    method: 'dtf',
    sizes: {
      '10x10': 4000, // 4,000원 for 10cm x 10cm
      A4: 5000,      // 5,000원 for A4 size
      A3: 7000       // 7,000원 for A3 size
    }
  },
  dtg: {
    method: 'dtg',
    sizes: {
      '10x10': 6000, // 6,000원 for 10cm x 10cm
      A4: 7000,      // 7,000원 for A4 size
      A3: 9000       // 9,000원 for A3 size
    }
  },
  screen_printing: {
    method: 'screen_printing',
    sizes: {
      '10x10': {
        basePrice: 60000,              // 60,000원 for first 100 pieces
        baseQuantity: 100,              // Base quantity
        additionalPricePerPiece: 600    // +600원 per additional piece
      },
      A4: {
        basePrice: 80000,              // 80,000원 for first 100 pieces
        baseQuantity: 100,
        additionalPricePerPiece: 800    // +800원 per additional piece
      },
      A3: {
        basePrice: 100000,             // 100,000원 for first 100 pieces
        baseQuantity: 100,
        additionalPricePerPiece: 1000   // +1,000원 per additional piece
      }
    }
  },
  embroidery: {
    method: 'embroidery',
    sizes: {
      '10x10': {
        basePrice: 60000,
        baseQuantity: 100,
        additionalPricePerPiece: 600
      },
      A4: {
        basePrice: 80000,
        baseQuantity: 100,
        additionalPricePerPiece: 800
      },
      A3: {
        basePrice: 100000,
        baseQuantity: 100,
        additionalPricePerPiece: 1000
      }
    }
  },
  applique: {
    method: 'applique',
    sizes: {
      '10x10': {
        basePrice: 60000,
        baseQuantity: 100,
        additionalPricePerPiece: 600
      },
      A4: {
        basePrice: 80000,
        baseQuantity: 100,
        additionalPricePerPiece: 800
      },
      A3: {
        basePrice: 100000,
        baseQuantity: 100,
        additionalPricePerPiece: 1000
      }
    }
  }
};

/**
 * Get the current pricing configuration
 * In the future, this can fetch from a database or admin settings
 */
export function getPrintPricingConfig(): PrintPricingConfig {
  // TODO: Fetch from database or admin settings
  // For now, return default configuration
  return DEFAULT_PRINT_PRICING;
}

/**
 * Recommend print method based on number of colors
 * If 4+ colors, recommend transfer methods (DTF or DTG)
 */
export function recommendPrintMethod(colorCount: number, objectSize: PrintSize): {
  recommended: 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique';
  reason: string;
} {
  if (colorCount >= 4) {
    return {
      recommended: 'dtf',
      reason: '4가지 이상의 색상은 전사 방식을 추천합니다'
    };
  }

  // For bulk orders with few colors, screen printing might be better
  // But for single items, transfer is usually better
  return {
    recommended: 'dtf',
    reason: '소량 주문에는 전사 방식이 적합합니다'
  };
}

/**
 * Get display name for print method in Korean
 */
export function getPrintMethodDisplayName(method: string): string {
  const displayNames: Record<string, string> = {
    dtf: 'DTF 전사',
    dtg: 'DTG 전사',
    screen_printing: '나염',
    embroidery: '자수',
    applique: '아플리케'
  };
  return displayNames[method] || method;
}

/**
 * Get short display name for print method in Korean
 */
export function getPrintMethodShortName(method: string): string {
  // First normalize to handle legacy methods
  const normalized = normalizePrintMethod(method) || method;
  const shortNames: Record<string, string> = {
    dtf: 'DTF',
    dtg: 'DTG',
    screen_printing: '나염',
    embroidery: '자수',
    applique: '아플리케'
  };
  return shortNames[normalized] || method;
}
