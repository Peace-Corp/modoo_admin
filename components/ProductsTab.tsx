'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Product } from '@/types/types';
import { Eye, EyeOff, Plus, Package, Edit2, Trash2, Star, Search, X } from 'lucide-react';
import ProductEditor from './ProductEditor';
import { getCategoryName, CATEGORIES } from '@/lib/categories';

export default function ProductsTab() {
  const { data: products = [], isLoading: loading, mutate } = useSWR<Product[]>('/api/admin/products');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchQuery === '' ||
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.manufacturers?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => Number(b.is_active) - Number(a.is_active));

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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

      mutate(products.map(p =>
        p.id === updatedProduct.id ? updatedProduct : p
      ), { revalidate: false });
    } catch (error) {
      console.error('Error toggling product status:', error);
    }
  };

  const toggleFeatured = async (productId: string, currentFeatured: boolean) => {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: productId, is_featured: !currentFeatured }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '추천 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedProduct = payload?.data as Product;

      mutate(products.map(p =>
        p.id === updatedProduct.id ? updatedProduct : p
      ), { revalidate: false });
    } catch (error) {
      console.error('Error toggling featured status:', error);
    }
  };

  const handleProductSave = (savedProduct: Product) => {
    if (isCreatingNew) {
      mutate([savedProduct, ...products], { revalidate: false });
    } else {
      mutate(products.map(p =>
        p.id === savedProduct.id ? savedProduct : p
      ), { revalidate: false });
    }
    setSelectedProduct(null);
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

      mutate(products.filter((product) => product.id !== productId), { revalidate: false });
    } catch (error) {
      console.error('Error deleting product:', error);
      alert(error instanceof Error ? error.message : '제품 삭제에 실패했습니다.');
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleCancel = () => {
    setSelectedProduct(null);
    setIsCreatingNew(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show Product Editor (for editing existing or creating new product)
  if (selectedProduct || isCreatingNew) {
    return (
      <ProductEditor
        product={selectedProduct}
        onSave={handleProductSave}
        onCancel={handleCancel}
      />
    );
  }


  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">제품 관리</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {filteredProducts.length === products.length
              ? `총 ${products.length}개의 제품`
              : `${filteredProducts.length} / ${products.length}개의 제품`}
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreatingNew(true);
            setSelectedProduct(null);
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">새 제품 추가</span>
          <span className="sm:hidden">추가</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="제품명, ID, 제조사 검색..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white sm:w-36"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.key} value={cat.key}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Products List */}
      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
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
                  제조사
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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  추천
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900">{product.title}</div>
                    <div className="text-xs text-gray-500">ID: {product.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-900">{product.category ? getCategoryName(product.category) : '-'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-900">{product.manufacturers?.name || '-'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-900">{product.base_price.toLocaleString()}원</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-900">{product.configuration?.length || 0}개</span>
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => toggleFeatured(product.id, product.is_featured)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        product.is_featured
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Star className={`w-3 h-3 ${product.is_featured ? 'fill-yellow-500' : ''}`} />
                      {product.is_featured ? '추천' : '일반'}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        편집
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

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-gray-200">
          {paginatedProducts.map((product) => (
            <div key={product.id} className="p-3 space-y-2">
              {/* Top row: title + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900 truncate">{product.title}</div>
                  <div className="text-[11px] text-gray-400">ID: {product.id.slice(0, 8)}...</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleFeatured(product.id, product.is_featured)}
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      product.is_featured
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <Star className={`w-2.5 h-2.5 ${product.is_featured ? 'fill-yellow-500' : ''}`} />
                    {product.is_featured ? '추천' : '일반'}
                  </button>
                  <button
                    onClick={() => toggleProductStatus(product.id, product.is_active)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      product.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {product.is_active ? (
                      <><Eye className="w-3 h-3" /> 활성</>
                    ) : (
                      <><EyeOff className="w-3 h-3" /> 비활성</>
                    )}
                  </button>
                </div>
              </div>

              {/* Info row */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                <span>{product.category ? getCategoryName(product.category) : '-'}</span>
                <span>{product.manufacturers?.name || '-'}</span>
                <span className="font-medium text-gray-700">{product.base_price.toLocaleString()}원</span>
                <span>{product.configuration?.length || 0}면</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 pt-1">
                <button
                  onClick={() => {
                    setSelectedProduct(product);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 rounded transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  편집
                </button>
                <button
                  onClick={() => handleDeleteProduct(product.id, product.title)}
                  disabled={deletingProductId === product.id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingProductId === product.id ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1 sm:mb-2">
              {products.length === 0 ? '제품이 없습니다' : '검색 결과가 없습니다'}
            </h3>
            <p className="text-xs text-gray-500">
              {products.length === 0 ? '새 제품을 추가해보세요.' : '다른 검색어나 필터를 시도해보세요.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-500">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} / {filteredProducts.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .reduce<(number | '...')[]>((acc, page, idx, arr) => {
                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(page);
                  return acc;
                }, [])
                .map((page, idx) =>
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-7 px-1.5 py-1 text-xs rounded ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
