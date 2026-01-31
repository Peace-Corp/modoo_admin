'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Package, Search, X } from 'lucide-react';
import { Product } from '@/types/types';
import AdminDesignEditor from '@/components/cobuy/AdminDesignEditor';
import OrderDetailsForm from './OrderDetailsForm';

type Step = 'product-select' | 'design' | 'details' | 'success';

interface AdminOrderCreatorProps {
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

export default function AdminOrderCreator({ onClose, onSuccess }: AdminOrderCreatorProps) {
  const [currentStep, setCurrentStep] = useState<Step>('product-select');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/admin/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        setProducts(data.data || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(product =>
    product.is_active && (
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setCurrentStep('design');
  };

  const handleDesignSaved = (designId: string) => {
    setSavedDesignId(designId);
    setCurrentStep('details');
  };

  const handleOrderCreated = (orderId: string) => {
    setCreatedOrderId(orderId);
    setCurrentStep('success');
    onSuccess?.(orderId);
  };

  const handleBack = () => {
    if (currentStep === 'design') {
      setCurrentStep('product-select');
      setSelectedProduct(null);
    } else if (currentStep === 'details') {
      setCurrentStep('design');
      setSavedDesignId(null);
    }
  };

  const handleViewOrder = () => {
    if (createdOrderId) {
      window.open(`/orders/${createdOrderId}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          {currentStep !== 'product-select' && currentStep !== 'success' && (
            <button
              onClick={handleBack}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold">주문 생성하기</h2>
            <p className="text-sm text-gray-500">
              {currentStep === 'product-select' && '제품을 선택하세요'}
              {currentStep === 'design' && '디자인을 만드세요'}
              {currentStep === 'details' && '주문 정보를 입력하세요'}
              {currentStep === 'success' && '주문이 생성되었습니다'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Progress indicator */}
      {currentStep !== 'success' && (
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-4 max-w-2xl mx-auto">
            {(['product-select', 'design', 'details'] as const).map((step, index) => {
              const stepIndex = ['product-select', 'design', 'details'].indexOf(step);
              const currentIndex = ['product-select', 'design', 'details'].indexOf(currentStep);
              const isCompleted = currentIndex > stepIndex;
              const isCurrent = currentStep === step;

              return (
                <div key={step} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${isCurrent ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {step === 'product-select' && '제품 선택'}
                    {step === 'design' && '디자인'}
                    {step === 'details' && '주문 정보'}
                  </span>
                  {index < 2 && (
                    <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
                  )}
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
                        {product.thumbnail_image_link ? (
                          <img
                            src={product.thumbnail_image_link}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
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

        {/* Step 2: Design Editor */}
        {currentStep === 'design' && selectedProduct && (
          <AdminDesignEditor
            product={selectedProduct}
            onDesignSaved={handleDesignSaved}
            onBack={handleBack}
          />
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

        {/* Step 4: Success */}
        {currentStep === 'success' && createdOrderId && (
          <div className="flex items-center justify-center min-h-full py-12">
            <div className="text-center max-w-md mx-auto px-6">
              <CheckCircle2 className="w-20 h-20 mx-auto mb-6 text-green-600" />
              <h3 className="text-2xl font-bold mb-2">주문이 생성되었습니다!</h3>
              <p className="text-gray-600 mb-8">
                주문 ID: {createdOrderId}
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-500 mb-2">제품</p>
                <p className="font-medium text-gray-900">{selectedProduct?.title}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleViewOrder}
                  className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
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
