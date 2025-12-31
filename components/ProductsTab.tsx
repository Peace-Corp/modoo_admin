'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Product } from '@/types/types';
import { Edit, Eye, EyeOff, Plus, Package, Edit2, ShoppingBag, ChevronLeft } from 'lucide-react';
import PrintAreaEditor from './PrintAreaEditor';
import ProductEditor from './ProductEditor';
import OrderCanvasRenderer from './OrderCanvasRenderer';

type EditorMode = 'print-area' | 'full-edit' | 'view-orders' | null;

export default function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [productOrderItems, setProductOrderItems] = useState<any[]>([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItemsForProduct = async (productId: string) => {
    setLoadingOrderItems(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProductOrderItems(data || []);
    } catch (error) {
      console.error('Error fetching order items:', error);
      setProductOrderItems([]);
    } finally {
      setLoadingOrderItems(false);
    }
  };

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) throw error;

      // Update local state
      setProducts(products.map(p =>
        p.id === productId ? { ...p, is_active: !currentStatus } : p
      ));
    } catch (error) {
      console.error('Error toggling product status:', error);
    }
  };

  const handleProductSave = (savedProduct: Product) => {
    if (isCreatingNew) {
      // Add new product to list
      setProducts([savedProduct, ...products]);
    } else {
      // Update existing product
      setProducts(products.map(p =>
        p.id === savedProduct.id ? savedProduct : p
      ));
    }
    setSelectedProduct(null);
    setEditorMode(null);
    setIsCreatingNew(false);
  };

  const handleCancel = () => {
    setSelectedProduct(null);
    setEditorMode(null);
    setIsCreatingNew(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show Print Area Editor
  if (editorMode === 'print-area' && selectedProduct) {
    return (
      <PrintAreaEditor
        product={selectedProduct}
        onSave={handleProductSave}
        onCancel={handleCancel}
      />
    );
  }

  // Show Product Editor (for creating or full editing)
  if (editorMode === 'full-edit' || isCreatingNew) {
    return (
      <ProductEditor
        product={selectedProduct}
        onSave={handleProductSave}
        onCancel={handleCancel}
      />
    );
  }

  // Show Order Items View
  if (editorMode === 'view-orders' && selectedProduct) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedProduct.title} - 주문 내역
            </h2>
            <p className="text-gray-500 mt-1">
              이 제품을 사용한 주문 아이템들을 확인할 수 있습니다 ({productOrderItems.length}개)
            </p>
          </div>
        </div>

        {/* Order Canvas Renderer */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {loadingOrderItems ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <OrderCanvasRenderer
              orderItems={productOrderItems}
              canvasWidth={400}
              canvasHeight={400}
              layout="grid"
              showItemInfo={true}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">제품 관리</h2>
          <p className="text-gray-500 mt-1">총 {products.length}개의 제품</p>
        </div>
        <button
          onClick={() => {
            setIsCreatingNew(true);
            setSelectedProduct(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 제품 추가
        </button>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  제품명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  카테고리
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  기본 가격
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  면 개수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.title}</div>
                    <div className="text-xs text-gray-500">ID: {product.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{product.category || '-'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{product.base_price.toLocaleString()}원</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{product.configuration?.length || 0}개</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleProductStatus(product.id, product.is_active)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        product.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {product.is_active ? (
                        <>
                          <Eye className="w-3 h-3" />
                          활성
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          비활성
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditorMode('full-edit');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        편집
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditorMode('print-area');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        인쇄 영역
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditorMode('view-orders');
                          fetchOrderItemsForProduct(product.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        주문 내역
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">제품이 없습니다</h3>
            <p className="text-gray-500">새 제품을 추가해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
