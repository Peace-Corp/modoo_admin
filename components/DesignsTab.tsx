'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SavedDesign } from '@/types/types';
import { Palette, Calendar, User, Package } from 'lucide-react';
import DesignDetail from './DesignDetail';

export default function DesignsTab() {
  const [mounted, setMounted] = useState(false);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Set mounted on client to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDesigns = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/admin/designs', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '디자인 데이터를 불러오지 못했습니다.');
      }

      const payload = await response.json();
      setDesigns(payload?.data || []);
    } catch (error) {
      console.error('Error fetching designs:', error);
      setDesigns([]);
      setErrorMessage(error instanceof Error ? error.message : '디자인 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredDesigns = useMemo(() => {
    if (!searchQuery.trim()) {
      return designs;
    }
    const query = searchQuery.toLowerCase();
    return designs.filter((design) => {
      const title = design.title?.toLowerCase() || '';
      const userEmail = design.user?.email?.toLowerCase() || '';
      const userName = design.user?.name?.toLowerCase() || '';
      const productTitle = design.product?.title?.toLowerCase() || '';
      return (
        title.includes(query) ||
        userEmail.includes(query) ||
        userName.includes(query) ||
        productTitle.includes(query)
      );
    });
  }, [designs, searchQuery]);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (selectedDesign) {
    return (
      <DesignDetail
        design={selectedDesign}
        onBack={() => setSelectedDesign(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">디자인 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {filteredDesigns.length}개의 디자인</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200/60 rounded-md p-3 shadow-sm">
        <input
          type="text"
          placeholder="디자인 제목, 사용자, 제품명으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Designs Grid */}
      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        {errorMessage && (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
            {errorMessage}
          </div>
        )}

        {filteredDesigns.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {filteredDesigns.map((design) => (
              <div
                key={design.id}
                onClick={() => setSelectedDesign(design)}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md hover:border-blue-300 cursor-pointer transition-all"
              >
                {/* Preview Image */}
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {design.preview_url ? (
                    <img
                      src={design.preview_url}
                      alt={design.title || '디자인 미리보기'}
                      className="w-full h-full object-contain"
                    />
                  ) : design.product?.thumbnail_image_link ? (
                    <img
                      src={design.product.thumbnail_image_link}
                      alt={design.product.title}
                      className="w-full h-full object-contain opacity-50"
                    />
                  ) : (
                    <Palette className="w-12 h-12 text-gray-300" />
                  )}
                </div>

                {/* Design Info */}
                <div className="p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {design.title || '제목 없음'}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Package className="w-3.5 h-3.5" />
                    <span className="truncate">{design.product?.title || '제품 정보 없음'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{design.user?.email || design.user?.name || '사용자 정보 없음'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(design.created_at)}</span>
                  </div>

                  {design.price_per_item > 0 && (
                    <div className="text-sm font-semibold text-blue-600">
                      {design.price_per_item.toLocaleString()}원
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Palette className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">디자인이 없습니다</h3>
            <p className="text-gray-500">사용자가 디자인을 저장하면 여기에 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
