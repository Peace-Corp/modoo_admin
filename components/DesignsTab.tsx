'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SavedDesign } from '@/types/types';
import { Palette, Calendar, User, Package, ChevronRight, ChevronLeft } from 'lucide-react';

interface PaginatedResponse {
  data: SavedDesign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function DesignsTab() {
  const [mounted, setMounted] = useState(false);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 10;

  // Set mounted on client to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDesigns = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/admin/designs?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '디자인 데이터를 불러오지 못했습니다.');
      }

      const payload: PaginatedResponse = await response.json();
      setDesigns(payload?.data || []);
      setTotal(payload?.total || 0);
      setTotalPages(payload?.totalPages || 0);
    } catch (error) {
      console.error('Error fetching designs:', error);
      setDesigns([]);
      setTotal(0);
      setTotalPages(0);
      setErrorMessage(error instanceof Error ? error.message : '디자인 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchDesigns();
  }, [fetchDesigns]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-xl font-semibold text-gray-900">디자인 관리</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">총 {total}개의 디자인</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200/60 rounded-md p-2 sm:p-3 shadow-sm">
        <input
          type="text"
          placeholder="디자인 제목, 사용자, 제품명으로 검색..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Designs List */}
      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        {errorMessage && (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
            {errorMessage}
          </div>
        )}

        {designs.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {designs.map((design) => (
              <Link
                key={design.id}
                href={`/editor/${design.product_id}?mode=design&designId=${design.id}`}
                className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-4 hover:bg-gray-50 transition-colors group"
              >
                {/* Preview Image */}
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gray-100 rounded flex items-center justify-center shrink-0">
                  {design.preview_url ? (
                    <img
                      src={design.preview_url}
                      alt={design.title || '디자인 미리보기'}
                      className="w-full h-full object-contain rounded"
                    />
                  ) : design.product?.thumbnail_image_link?.[0] ? (
                    <img
                      src={design.product.thumbnail_image_link[0]}
                      alt={design.product.title}
                      className="w-full h-full object-contain opacity-50 rounded"
                    />
                  ) : (
                    <Palette className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />
                  )}
                </div>

                {/* Design Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 truncate mb-0.5 sm:mb-1">
                    {design.title || '제목 없음'}
                  </h3>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 text-[11px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">
                    <div className="flex items-center gap-1">
                      <Package className="w-3 h-3 shrink-0" />
                      <span className="truncate">{design.product?.title || '제품 정보 없음'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{design.user?.email || design.user?.name || '사용자 정보 없음'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] sm:text-xs text-gray-400">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>{formatDate(design.created_at)}</span>
                  </div>
                </div>

                {/* Price and Arrow */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  {design.price_per_item > 0 && (
                    <div className="text-xs sm:text-sm font-semibold text-blue-600">
                      {design.price_per_item.toLocaleString()}원
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-gray-600" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <Palette className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">디자인이 없습니다</h3>
            <p className="text-xs sm:text-sm text-gray-500">사용자가 디자인을 저장하면 여기에 표시됩니다.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs sm:text-sm text-gray-500">
              {total}개 중 {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, total)}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                이전
              </button>
              <span className="text-xs sm:text-sm text-gray-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                다음
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
