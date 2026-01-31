'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Minus, Plus, Loader2, Search, MapPin } from 'lucide-react';
import { Product, SizeOption } from '@/types/types';
import AddressSearch from './AddressSearch';

type ShippingMethod = 'pickup' | 'domestic';

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

interface OrderDetailsFormProps {
  product: Product;
  savedDesignId: string;
  onSubmit: (orderId: string) => void;
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

  // Initialize variants from product size options
  useEffect(() => {
    const sizeOptions = product.size_options || [];
    const initialVariants: OrderVariant[] = sizeOptions.map((opt: SizeOption) => ({
      sizeLabel: opt.label,
      sizeCode: opt.size_code,
      quantity: 0,
    }));
    setVariants(initialVariants);
  }, [product.size_options]);

  // Calculate totals
  const totalQuantity = useMemo(() => {
    return variants.reduce((sum, v) => sum + v.quantity, 0);
  }, [variants]);

  const totalAmount = useMemo(() => {
    return product.base_price * totalQuantity;
  }, [product.base_price, totalQuantity]);

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

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!customerName.trim()) {
      setError('고객 이름을 입력해주세요.');
      return;
    }

    if (!customerEmail.trim()) {
      setError('고객 이메일을 입력해주세요.');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (totalQuantity <= 0) {
      setError('최소 하나 이상의 수량을 선택해주세요.');
      return;
    }

    // Validate shipping address for domestic shipping
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
        headers: {
          'Content-Type': 'application/json',
        },
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
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '주문 생성에 실패했습니다.');
      }

      onSubmit(result.data.orderId);
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
        <p className="text-gray-500 mt-1">고객 정보와 수량을 입력하세요</p>
      </div>

      {/* Error message */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호
            </label>
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

        {/* Shipping Method Selection */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="shippingMethod"
              value="pickup"
              checked={shippingMethod === 'pickup'}
              onChange={() => setShippingMethod('pickup')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-700">직접 수령</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="shippingMethod"
              value="domestic"
              checked={shippingMethod === 'domestic'}
              onChange={() => setShippingMethod('domestic')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-700">국내 배송</span>
          </label>
        </div>

        {/* Address Fields for Domestic Shipping */}
        {shippingMethod === 'domestic' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            {/* Address Search Button */}
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

            {/* Display Selected Address */}
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

            {/* Detail Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상세 주소
              </label>
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
            <div
              key={variant.sizeCode}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-900 w-16">
                  {variant.sizeLabel}
                </span>
                <span className="text-sm text-gray-500">
                  ({variant.sizeCode})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuantityChange(index, -1)}
                  disabled={variant.quantity <= 0}
                  className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min="0"
                  value={variant.quantity}
                  onChange={(e) => handleQuantityInput(index, e.target.value)}
                  className="w-16 text-center p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={() => handleQuantityChange(index, 1)}
                  className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-100"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {variants.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              이 제품에는 사이즈 옵션이 없습니다.
            </div>
          )}
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
            <span>단가</span>
            <span>{product.base_price.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>총 수량</span>
            <span>{totalQuantity}개</span>
          </div>
          <div className="border-t border-blue-200 my-2" />
          <div className="flex justify-between font-bold text-lg">
            <span>총 금액</span>
            <span className="text-blue-600">{totalAmount.toLocaleString()}원</span>
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
          <span>주문 생성하기</span>
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
