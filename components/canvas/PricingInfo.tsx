'use client'
import { useCanvasStore } from "@/store/useCanvasStore";
import { ProductSide } from "@/types/types";
import { calculateAllSidesPricing, SidePricing } from "@/app/utils/canvasPricing";
import { useMemo } from "react";

interface PricingInfoProps {
  basePrice: number;
  sides: ProductSide[];
}

export default function PricingInfo({ basePrice, sides }: PricingInfoProps) {
  const { canvasMap, canvasVersion } = useCanvasStore();

  // Calculate pricing dynamically whenever canvases change
  // canvasVersion is included to trigger recalculation when canvas objects are added/removed/modified
  const pricingData = useMemo(() => {
    return calculateAllSidesPricing(canvasMap, sides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMap, sides, canvasVersion]);

  const totalPrice = basePrice + pricingData.totalAdditionalPrice;

  // Filter only sides that have objects
  const sidesWithObjects = pricingData.sidePricing.filter(sp => sp.hasObjects);

  // Don't show pricing breakdown if no objects added
  if (sidesWithObjects.length === 0) {
    return null;
  }

  return (
    <div className="w-full border-t border-gray-200 pt-3 mt-3">
      <div className="flex flex-col gap-2">
        {/* Price Breakdown Header */}
        <p className="text-sm font-semibold text-gray-700">가격 상세</p>

        {/* Base Price */}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">기본 가격</span>
          <span className="text-gray-900">{basePrice.toLocaleString('ko-KR')}원</span>
        </div>

        {/* Additional Prices per Side */}
        {sidesWithObjects.map((sidePricing: SidePricing) => (
          <div key={sidePricing.sideId} className="flex justify-between text-sm">
            <span className="text-gray-600">
              {sidePricing.sideName} 인쇄
            </span>
            <span className="text-gray-900">
              +{sidePricing.additionalPrice.toLocaleString('ko-KR')}원
            </span>
          </div>
        ))}

        {/* Divider */}
        <div className="border-t border-gray-200 my-1"></div>

        {/* Total Price */}
        <div className="flex justify-between text-base font-bold">
          <span className="text-gray-900">총 가격</span>
          <span className="text-black">{totalPrice.toLocaleString('ko-KR')}원</span>
        </div>

        {/* Per Item Note */}
        <p className="text-xs text-gray-500">* 1개당 가격입니다</p>
      </div>
    </div>
  );
}