'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types/types';
import { Edit, Eye, EyeOff, Plus, Package, Edit2, Trash2, Layers } from 'lucide-react';
import PrintAreaEditor from './PrintAreaEditor';
import ProductEditor from './ProductEditor';
import EditTemplateTab from './EditTemplateTab';

type EditorMode = 'print-area' | 'full-edit' | 'template-edit' | null;

export default function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '제품 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setProducts(payload?.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };


  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: productId, is_active: !currentStatus }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '제품 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedProduct = payload?.data as Product;

      setProducts(products.map(p =>
        p.id === updatedProduct.id ? updatedProduct : p
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

  const handleDeleteProduct = async (productId: string, productTitle: string) => {
    const confirmed = window.confirm(`"${productTitle}" 제품을 삭제할까요?`);
    if (!confirmed) return;

    setDeletingProductId(productId);
    try {
      const response = await fetch(`/api/admin/products?id=${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '제품 삭제에 실패했습니다.');
      }

      setProducts((prev) => prev.filter((product) => product.id !== productId));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert(error instanceof Error ? error.message : '제품 삭제에 실패했습니다.');
    } finally {
      setDeletingProductId(null);
    }
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

  // Show Template Editor
  if (editorMode === 'template-edit' && selectedProduct) {
    return (
      <EditTemplateTab
        product={selectedProduct}
        onClose={handleCancel}
      />
    );
  }


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">제품 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {products.length}개의 제품</p>
        </div>
        <button
          onClick={() => {
            setIsCreatingNew(true);
            setSelectedProduct(null);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          새 제품 추가
        </button>
      </div>

      {/* Products List */}
      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  제품명
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  카테고리
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  기본 가격
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  면 개수
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.title}</div>
                    <div className="text-xs text-gray-500">ID: {product.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{product.category || '-'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{product.base_price.toLocaleString()}원</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{product.configuration?.length || 0}개</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
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
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditorMode('full-edit');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        편집
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditorMode('print-area');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        인쇄 영역
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditorMode('template-edit');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                      >
                        <Layers className="w-4 h-4" />
                        템플릿
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.title)}
                        disabled={deletingProductId === product.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingProductId === product.id ? '삭제 중...' : '삭제'}
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
