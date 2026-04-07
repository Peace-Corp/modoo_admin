'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Minus, Plus, Loader2, Search, MapPin, Tag, Percent, DollarSign, CreditCard, Building2, Link2 } from 'lucide-react';
import { Product, SizeOption } from '@/types/types';
import AddressSearch from './AddressSearch';

type ShippingMethod = 'pickup' | 'domestic';
type PricingMode = 'auto' | 'custom_unit_price' | 'custom_total';
type PaymentType = 'completed' | 'bank_transfer' | 'customer_payment';
type AdminDiscountType = 'fixed' | 'percentage';

interface OrderVariant {
  sizeLabel: string;
  sizeCode: string;
  quantity: number;
}

interface ShippingAddress {
  postalCode: string;
  state: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
}

interface CouponInfo {
  couponId: string;
  code: string;
  displayName: string;
  discountAmount: number;
  discountText: string;
}

interface OrderCreateResult {
  orderId: string;
  totalAmount: number;
  originalAmount: number;
  totalQuantity: number;
  paymentType: PaymentType;
  paymentLinkToken: string | null;
  paymentLinkUrl: string | null;
}

interface OrderDetailsFormProps {
  product: Product;
  savedDesignId: string;
  onSubmit: (orderId: string, result?: OrderCreateResult) => void;
  onBack: () => void;
}

export default function OrderDetailsForm({
  product,
  savedDesignId,
  onSubmit,
  onBack,
}: OrderDetailsFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [variants, setVariants] = useState<OrderVariant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designPricePerItem, setDesignPricePerItem] = useState<number | null>(null);

  // Shipping fields
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('pickup');
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    postalCode: '',
    state: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
  });

  // Pricing adjustment fields
  const [pricingMode, setPricingMode] = useState<PricingMode>('auto');
  const [customUnitPrice, setCustomUnitPrice] = useState<string>('');
  const [customTotalPrice, setCustomTotalPrice] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState<CouponInfo | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCouponValidating, setIsCouponValidating] = useState(false);
  const [adminDiscountType, setAdminDiscountType] = useState<AdminDiscountType>('fixed');
  const [adminDiscountValue, setAdminDiscountValue] = useState<string>('');
  const [adminSurcharge, setAdminSurcharge] = useState<string>('');
  const [pricingNote, setPricingNote] = useState('');

  // Payment type
  const [paymentType, setPaymentType] = useState<PaymentType>('completed');

  useEffect(() => {
    const fetchDesignPrice = async () => {
      try {
        const res = await fetch(`/api/admin/designs/${savedDesignId}`);
        if (res.ok) {
          const data = await res.json();
          const price = data?.data?.price_per_item;
          if (price && price > 0) {
            setDesignPricePerItem(price);
          }
        }
      } catch (err) {
        console.error('Failed to fetch design price:', err);
      }
    };
    fetchDesignPrice();
  }, [savedDesignId]);

  useEffect(() => {
    const sizeOptions = product.size_options || [];
    const initialVariants: OrderVariant[] = sizeOptions.map((opt: SizeOption) => ({
      sizeLabel: opt.label,
      sizeCode: opt.size_code,
      quantity: 0,
    }));
    setVariants(initialVariants);
  }, [product.size_options]);

  const totalQuantity = useMemo(() => {
    return variants.reduce((sum, v) => sum + v.quantity, 0);
  }, [variants]);

  const unitPrice = useMemo(() => {
    if (pricingMode === 'custom_unit_price') {
      const parsed = parseFloat(customUnitPrice);
      return parsed > 0 ? parsed : 0;
    }
    return designPricePerItem ?? product.base_price;
  }, [pricingMode, customUnitPrice, designPricePerItem, product.base_price]);

  const originalAmount = useMemo(() => unitPrice * totalQuantity, [unitPrice, totalQuantity]);

  const computedAdminDiscount = useMemo(() => {
    const val = parseFloat(adminDiscountValue) || 0;
    if (val <= 0) return 0;
    if (adminDiscountType === 'percentage') {
      return Math.floor(originalAmount * (val / 100));
    }
    return val;
  }, [adminDiscountValue, adminDiscountType, originalAmount]);

  const computedSurcharge = useMemo(() => {
    return Math.max(0, parseFloat(adminSurcharge) || 0);
  }, [adminSurcharge]);

  const computedCouponDiscount = useMemo(() => {
    return couponInfo?.discountAmount ?? 0;
  }, [couponInfo]);

  const totalAmount = useMemo(() => {
    if (pricingMode === 'custom_total') {
      const parsed = parseFloat(customTotalPrice);
      return parsed > 0 ? parsed : 0;
    }
    return Math.max(0, originalAmount - computedCouponDiscount - computedAdminDiscount + computedSurcharge);
  }, [pricingMode, customTotalPrice, originalAmount, computedCouponDiscount, computedAdminDiscount, computedSurcharge]);

  // Revalidate coupon when originalAmount changes
  useEffect(() => {
    if (couponInfo && originalAmount > 0) {
      handleCouponValidate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalAmount]);

  const handleQuantityChange = (index: number, delta: number) => {
    setVariants((prev) => {
      const updated = [...prev];
      const newQuantity = Math.max(0, updated[index].quantity + delta);
      updated[index] = { ...updated[index], quantity: newQuantity };
      return updated;
    });
  };

  const handleQuantityInput = (index: number, value: string) => {
    const quantity = parseInt(value, 10);
    if (!isNaN(quantity) && quantity >= 0) {
      setVariants((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], quantity };
        return updated;
      });
    }
  };

  const handleCouponValidate = async (silent = false) => {
    const code = couponCode.trim();
    if (!code) {
      if (!silent) setCouponError('쿠폰 코드를 입력해주세요.');
      return;
    }

    setIsCouponValidating(true);
    setCouponError(null);

    try {
      const res = await fetch('/api/admin/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, orderTotal: originalAmount }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCouponInfo(null);
        if (!silent) setCouponError(data.error || '쿠폰 검증에 실패했습니다.');
        return;
      }

      setCouponInfo({
        couponId: data.data.couponId,
        code: data.data.code,
        displayName: data.data.displayName,
        discountAmount: data.data.discountAmount,
        discountText: data.data.discountText,
      });
      setCouponError(null);
    } catch {
      if (!silent) setCouponError('쿠폰 검증 중 오류가 발생했습니다.');
    } finally {
      setIsCouponValidating(false);
    }
  };

  const handleCouponRemove = () => {
    setCouponInfo(null);
    setCouponCode('');
    setCouponError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!customerName.trim()) {
      setError('고객 이름을 입력해주세요.');
      return;
    }

    if (!customerEmail.trim()) {
      setError('고객 이메일을 입력해주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (totalQuantity <= 0) {
      setError('최소 하나 이상의 수량을 선택해주세요.');
      return;
    }

    if (pricingMode === 'custom_unit_price' && unitPrice <= 0) {
      setError('단가를 입력해주세요.');
      return;
    }

    if (pricingMode === 'custom_total' && totalAmount <= 0) {
      setError('전체 금액을 입력해주세요.');
      return;
    }

    if (shippingMethod === 'domestic') {
      if (!shippingAddress.postalCode || !shippingAddress.addressLine1) {
        setError('배송 주소를 입력해주세요.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: savedDesignId,
          productId: product.id,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || undefined,
          variants: variants.filter((v) => v.quantity > 0),
          notes: notes.trim() || undefined,
          shippingMethod,
          ...(shippingMethod === 'domestic' && {
            postalCode: shippingAddress.postalCode,
            state: shippingAddress.state,
            city: shippingAddress.city,
            addressLine1: shippingAddress.addressLine1,
            addressLine2: shippingAddress.addressLine2 || undefined,
          }),
          pricingMode,
          customUnitPrice: pricingMode === 'custom_unit_price' ? unitPrice : undefined,
          customTotalPrice: pricingMode === 'custom_total' ? totalAmount : undefined,
          couponCode: pricingMode !== 'custom_total' ? (couponInfo?.code || undefined) : undefined,
          couponId: pricingMode !== 'custom_total' ? (couponInfo?.couponId || undefined) : undefined,
          couponDiscount: pricingMode !== 'custom_total' ? (computedCouponDiscount || undefined) : undefined,
          adminDiscount: pricingMode !== 'custom_total' ? (computedAdminDiscount || undefined) : undefined,
          adminDiscountType: pricingMode !== 'custom_total' && computedAdminDiscount > 0 ? adminDiscountType : undefined,
          adminSurcharge: pricingMode !== 'custom_total' ? (computedSurcharge || undefined) : undefined,
          pricingNote: pricingNote.trim() || undefined,
          paymentType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '주문 생성에 실패했습니다.');
      }

      onSubmit(result.data.orderId, result.data as OrderCreateResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '주문 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>뒤로</span>
        </button>
        <h2 className="text-2xl font-bold">주문 정보 입력</h2>
        <p className="text-gray-500 mt-1">고객 정보, 수량, 가격 및 결제 방식을 설정하세요</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Customer Info Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">고객 정보</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="고객 이름"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Shipping Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">배송 정보</h3>
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="shippingMethod" value="pickup" checked={shippingMethod === 'pickup'} onChange={() => setShippingMethod('pickup')} className="w-4 h-4 text-blue-600" />
            <span className="text-gray-700">직접 수령</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="shippingMethod" value="domestic" checked={shippingMethod === 'domestic'} onChange={() => setShippingMethod('domestic')} className="w-4 h-4 text-blue-600" />
            <span className="text-gray-700">국내 배송</span>
          </label>
        </div>

        {shippingMethod === 'domestic' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddressSearch(true)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-left flex items-center gap-2 hover:border-blue-500 transition-colors"
              >
                <Search className="w-4 h-4 text-gray-400" />
                {shippingAddress.addressLine1 ? (
                  <span className="text-gray-900">{shippingAddress.addressLine1}</span>
                ) : (
                  <span className="text-gray-400">주소 검색</span>
                )}
              </button>
            </div>
            {shippingAddress.addressLine1 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      [{shippingAddress.postalCode}] {shippingAddress.addressLine1}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {shippingAddress.state} {shippingAddress.city}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상세 주소</label>
              <input
                type="text"
                value={shippingAddress.addressLine2}
                onChange={(e) => setShippingAddress(prev => ({ ...prev, addressLine2: e.target.value }))}
                placeholder="상세 주소 입력 (동, 호수 등)"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Size/Quantity Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">사이즈 및 수량</h3>
        <div className="space-y-3">
          {variants.map((variant, index) => (
            <div key={variant.sizeCode} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-900 w-16">{variant.sizeLabel}</span>
                <span className="text-sm text-gray-500">({variant.sizeCode})</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleQuantityChange(index, -1)} disabled={variant.quantity <= 0} className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Minus className="w-4 h-4" />
                </button>
                <input type="number" min="0" value={variant.quantity} onChange={(e) => handleQuantityInput(index, e.target.value)} className="w-16 text-center p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => handleQuantityChange(index, 1)} className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {variants.length === 0 && (
            <div className="text-center py-8 text-gray-500">이 제품에는 사이즈 옵션이 없습니다.</div>
          )}
        </div>
      </div>

      {/* Pricing Adjustment Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          가격 설정
        </h3>
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          {/* Pricing Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">가격 설정 방식</label>
            <div className="flex flex-wrap gap-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pricingMode" value="auto" checked={pricingMode === 'auto'} onChange={() => setPricingMode('auto')} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">자동 계산 ({(designPricePerItem ?? product.base_price).toLocaleString()}원/개)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pricingMode" value="custom_unit_price" checked={pricingMode === 'custom_unit_price'} onChange={() => setPricingMode('custom_unit_price')} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">개당 단가 입력</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pricingMode" value="custom_total" checked={pricingMode === 'custom_total'} onChange={() => setPricingMode('custom_total')} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">전체 금액 입력</span>
              </label>
            </div>
            {pricingMode === 'custom_unit_price' && (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={customUnitPrice}
                  onChange={(e) => setCustomUnitPrice(e.target.value)}
                  placeholder="개당 단가 입력"
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">원/개</span>
              </div>
            )}
            {pricingMode === 'custom_total' && (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={customTotalPrice}
                  onChange={(e) => setCustomTotalPrice(e.target.value)}
                  placeholder="최종 결제 금액 직접 입력"
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">원</span>
              </div>
            )}
          </div>

          {/* Coupon / Discount / Surcharge - hidden when custom_total */}
          {pricingMode !== 'custom_total' && (
            <>
              {/* Coupon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Tag className="w-4 h-4" /> 쿠폰 적용
                </label>
                {couponInfo ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-green-800">{couponInfo.displayName}</p>
                      <p className="text-xs text-green-600">{couponInfo.discountText} (-{couponInfo.discountAmount.toLocaleString()}원)</p>
                    </div>
                    <button onClick={handleCouponRemove} className="text-green-600 hover:text-green-800 text-sm font-medium">
                      제거
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value); setCouponError(null); }}
                      placeholder="쿠폰 코드 입력"
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCouponValidate(); }}
                    />
                    <button
                      onClick={() => handleCouponValidate()}
                      disabled={isCouponValidating || !couponCode.trim()}
                      className="px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                    >
                      {isCouponValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : '적용'}
                    </button>
                  </div>
                )}
                {couponError && <p className="mt-1 text-xs text-red-500">{couponError}</p>}
              </div>

              {/* Admin Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Percent className="w-4 h-4" /> 임의 할인
                </label>
                <div className="flex gap-2">
                  <select
                    value={adminDiscountType}
                    onChange={(e) => setAdminDiscountType(e.target.value as AdminDiscountType)}
                    className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value="fixed">금액(원)</option>
                    <option value="percentage">비율(%)</option>
                  </select>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      value={adminDiscountValue}
                      onChange={(e) => setAdminDiscountValue(e.target.value)}
                      placeholder={adminDiscountType === 'fixed' ? '할인 금액' : '할인 비율'}
                      className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      {adminDiscountType === 'fixed' ? '원' : '%'}
                    </span>
                  </div>
                </div>
                {computedAdminDiscount > 0 && (
                  <p className="mt-1 text-xs text-orange-600">할인 적용: -{computedAdminDiscount.toLocaleString()}원</p>
                )}
              </div>

              {/* Admin Surcharge */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> 추가 금액
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={adminSurcharge}
                    onChange={(e) => setAdminSurcharge(e.target.value)}
                    placeholder="추가 금액 (인쇄비, 급행 수수료 등)"
                    className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">원</span>
                </div>
              </div>
            </>
          )}

          {pricingMode === 'custom_total' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">전체 금액 직접 입력 모드에서는 쿠폰/할인/추가금액이 적용되지 않습니다.</p>
            </div>
          )}

          {/* Pricing Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">조정 사유 메모</label>
            <input
              type="text"
              value={pricingNote}
              onChange={(e) => setPricingNote(e.target.value)}
              placeholder="가격 조정 사유 (내부 참고용)"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Payment Type Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          결제 방식
        </h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50" style={{ borderColor: paymentType === 'completed' ? '#2563eb' : '#e5e7eb', backgroundColor: paymentType === 'completed' ? '#eff6ff' : 'white' }}>
            <input type="radio" name="paymentType" value="completed" checked={paymentType === 'completed'} onChange={() => setPaymentType('completed')} className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">결제 완료 처리</p>
              <p className="text-sm text-gray-500">즉시 결제 완료로 처리합니다 (관리자가 직접 수금한 경우)</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50" style={{ borderColor: paymentType === 'bank_transfer' ? '#2563eb' : '#e5e7eb', backgroundColor: paymentType === 'bank_transfer' ? '#eff6ff' : 'white' }}>
            <input type="radio" name="paymentType" value="bank_transfer" checked={paymentType === 'bank_transfer'} onChange={() => setPaymentType('bank_transfer')} className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">무통장입금 대기</p>
                <p className="text-sm text-gray-500">고객의 입금 확인 후 관리자가 수동으로 결제 완료 처리합니다</p>
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50" style={{ borderColor: paymentType === 'customer_payment' ? '#2563eb' : '#e5e7eb', backgroundColor: paymentType === 'customer_payment' ? '#eff6ff' : 'white' }}>
            <input type="radio" name="paymentType" value="customer_payment" checked={paymentType === 'customer_payment'} onChange={() => setPaymentType('customer_payment')} className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">고객 온라인 결제</p>
                <p className="text-sm text-gray-500">결제 링크를 생성하여 고객이 직접 온라인 결제합니다</p>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Notes Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">메모 (선택)</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="주문에 대한 메모를 입력하세요..."
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Price Summary */}
      <div className="mb-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">주문 요약</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-gray-700">
            <span>제품</span>
            <span>{product.title}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>총 수량</span>
            <span>{totalQuantity}개</span>
          </div>

          {pricingMode !== 'custom_total' && (
            <>
              <div className="flex justify-between text-gray-700">
                <span>단가</span>
                <span>{unitPrice.toLocaleString()}원</span>
              </div>
              {pricingMode === 'auto' && designPricePerItem && designPricePerItem > product.base_price && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>기본가 + 디자인</span>
                  <span>{product.base_price.toLocaleString()}원 + {(designPricePerItem - product.base_price).toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>소계</span>
                <span>{originalAmount.toLocaleString()}원</span>
              </div>
              {computedCouponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>쿠폰 할인 ({couponInfo?.displayName})</span>
                  <span>-{computedCouponDiscount.toLocaleString()}원</span>
                </div>
              )}
              {computedAdminDiscount > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>임의 할인</span>
                  <span>-{computedAdminDiscount.toLocaleString()}원</span>
                </div>
              )}
              {computedSurcharge > 0 && (
                <div className="flex justify-between text-purple-600">
                  <span>추가 금액</span>
                  <span>+{computedSurcharge.toLocaleString()}원</span>
                </div>
              )}
            </>
          )}

          {pricingMode === 'custom_total' && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>가격 설정</span>
              <span>전체 금액 직접 입력</span>
            </div>
          )}

          <div className="border-t border-blue-200 my-2" />
          <div className="flex justify-between font-bold text-lg">
            <span>최종 금액</span>
            <span className="text-blue-600">{totalAmount.toLocaleString()}원</span>
          </div>

          {/* Payment type indicator */}
          <div className="mt-2 pt-2 border-t border-blue-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">결제 방식</span>
              <span className="font-medium text-gray-800">
                {paymentType === 'completed' && '결제 완료 처리'}
                {paymentType === 'bank_transfer' && '무통장입금 대기'}
                {paymentType === 'customer_payment' && '고객 온라인 결제 (링크 발급)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || totalQuantity <= 0}
        className="w-full py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>주문 생성 중...</span>
          </>
        ) : (
          <span>
            {paymentType === 'customer_payment' ? '주문 생성 및 결제 링크 발급' : '주문 생성하기'}
          </span>
        )}
      </button>

      {/* Address Search Modal */}
      {showAddressSearch && (
        <AddressSearch
          onSelect={(address) => {
            setShippingAddress({
              postalCode: address.postalCode,
              state: address.state,
              city: address.city,
              addressLine1: address.addressLine1,
              addressLine2: '',
            });
          }}
          onClose={() => setShowAddressSearch(false)}
        />
      )}
    </div>
  );
}
