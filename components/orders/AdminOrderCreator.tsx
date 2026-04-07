'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Package, Search, X, Copy, Check, ExternalLink, Clock, Link2 } from 'lucide-react';
import { Product } from '@/types/types';
import OrderDetailsForm from './OrderDetailsForm';

type Step = 'product-select' | 'details' | 'success';
type PaymentType = 'completed' | 'bank_transfer' | 'customer_payment';

interface OrderCreateResult {
  orderId: string;
  totalAmount: number;
  originalAmount: number;
  totalQuantity: number;
  paymentType: PaymentType;
  paymentLinkToken: string | null;
  paymentLinkUrl: string | null;
}

interface AdminOrderCreatorProps {
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
  initialProductId?: string;
  initialDesignId?: string;
}

export default function AdminOrderCreator({ onClose, onSuccess, initialProductId, initialDesignId }: AdminOrderCreatorProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(
    initialProductId && initialDesignId ? 'details' : 'product-select'
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(initialDesignId ?? null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderCreateResult | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/admin/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        const fetched: Product[] = data.data || [];
        setProducts(fetched);

        if (initialProductId && initialDesignId) {
          const product = fetched.find((p) => p.id === initialProductId);
          if (product) setSelectedProduct(product);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [initialProductId, initialDesignId]);

  const filteredProducts = products.filter(product =>
    product.is_active && (
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleProductSelect = (product: Product) => {
    const returnUrl = encodeURIComponent(`/orders?resumeProductId=${product.id}`);
    router.push(`/editor/${product.id}?mode=design&returnUrl=${returnUrl}`);
  };

  const handleOrderCreated = (orderId: string, result?: OrderCreateResult) => {
    setCreatedOrderId(orderId);
    setOrderResult(result ?? null);
    setCurrentStep('success');
    onSuccess?.(orderId);
  };

  const handleBack = () => {
    if (currentStep === 'details') {
      setCurrentStep('product-select');
      setSelectedProduct(null);
      setSavedDesignId(null);
    }
  };

  const handleViewOrder = () => {
    if (createdOrderId) {
      window.open(`/orders/${createdOrderId}`, '_blank');
    }
  };

  const handleCopyLink = async () => {
    if (orderResult?.paymentLinkUrl) {
      try {
        await navigator.clipboard.writeText(orderResult.paymentLinkUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch {
        const input = document.createElement('input');
        input.value = orderResult.paymentLinkUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          {currentStep === 'details' && (
            <button onClick={handleBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold">주문 생성하기</h2>
            <p className="text-sm text-gray-500">
              {currentStep === 'product-select' && '제품을 선택하세요'}
              {currentStep === 'details' && '주문 정보를 입력하세요'}
              {currentStep === 'success' && '주문이 생성되었습니다'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Progress indicator */}
      {currentStep !== 'success' && (
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-4 max-w-2xl mx-auto">
            {(['product-select', 'design', 'details'] as const).map((step, index) => {
              const stepOrder = ['product-select', 'design', 'details'];
              const stepIndex = stepOrder.indexOf(step);
              const currentIndex = currentStep === 'details' ? 2 : 0;
              const isCompleted = currentIndex > stepIndex;
              const isCurrent = (step === 'product-select' && currentStep === 'product-select')
                || (step === 'details' && currentStep === 'details');

              return (
                <div key={step} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    isCurrent ? 'bg-blue-600 text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${isCurrent ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {step === 'product-select' && '제품 선택'}
                    {step === 'design' && '디자인'}
                    {step === 'details' && '주문 정보'}
                  </span>
                  {index < 2 && <div className="flex-1 h-0.5 bg-gray-200 mx-4" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Step 1: Product Selection */}
        {currentStep === 'product-select' && (
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="제품명 또는 카테고리로 검색..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        {product.thumbnail_image_link?.[0] ? (
                          <img src={product.thumbnail_image_link[0]} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-12 h-12 text-gray-300" />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-500">{product.category || '카테고리 없음'}</p>
                        <p className="font-medium text-gray-900 truncate">{product.title}</p>
                        <p className="text-sm text-blue-600">{product.base_price.toLocaleString()}원</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Order Details Form */}
        {currentStep === 'details' && selectedProduct && savedDesignId && (
          <OrderDetailsForm
            product={selectedProduct}
            savedDesignId={savedDesignId}
            onSubmit={handleOrderCreated}
            onBack={handleBack}
          />
        )}

        {/* Loading state when resuming from editor */}
        {currentStep === 'details' && !selectedProduct && (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Step 4: Success */}
        {currentStep === 'success' && createdOrderId && (
          <div className="flex items-center justify-center min-h-full py-12">
            <div className="text-center max-w-md mx-auto px-6">
              <CheckCircle2 className="w-20 h-20 mx-auto mb-6 text-green-600" />
              <h3 className="text-2xl font-bold mb-2">주문이 생성되었습니다!</h3>
              <p className="text-gray-600 mb-6">주문 ID: {createdOrderId}</p>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-500 mb-2">제품</p>
                <p className="font-medium text-gray-900">{selectedProduct?.title}</p>
              </div>

              {orderResult && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">결제 금액</span>
                    <span className="font-medium">{orderResult.totalAmount.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">결제 방식</span>
                    <span className="font-medium">
                      {orderResult.paymentType === 'completed' && '결제 완료'}
                      {orderResult.paymentType === 'bank_transfer' && '무통장입금 대기'}
                      {orderResult.paymentType === 'customer_payment' && '고객 온라인 결제'}
                    </span>
                  </div>
                </div>
              )}

              {/* Bank transfer notice */}
              {orderResult?.paymentType === 'bank_transfer' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-800">입금 확인 대기 중</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        고객의 입금이 확인되면 주문 상세 페이지에서 결제 완료 처리를 해주세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer payment link */}
              {orderResult?.paymentType === 'customer_payment' && orderResult.paymentLinkUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                  <div className="flex items-start gap-2 mb-3">
                    <Link2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-blue-800">고객 결제 링크</p>
                      <p className="text-sm text-blue-700 mt-1">
                        아래 링크를 고객에게 공유하면 디자인 확인 후 결제할 수 있습니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={orderResult.paymentLinkUrl}
                      className="flex-1 p-2 text-sm border border-blue-200 rounded bg-white text-gray-700 truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm whitespace-nowrap"
                    >
                      {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {linkCopied ? '복사됨' : '복사'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleViewOrder}
                  className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  주문 보기
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  완료
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
