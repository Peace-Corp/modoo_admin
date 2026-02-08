'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Loader2,
  Building2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Package,
  Eye,
} from 'lucide-react';
import { PartnerMall } from '@/types/types';
import PartnerMallCreator from './partner-malls/PartnerMallCreator';

export default function PartnerMallsTab() {
  const [partnerMalls, setPartnerMalls] = useState<PartnerMall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch partner malls
  const fetchPartnerMalls = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/partner-malls');
      if (!response.ok) {
        throw new Error('파트너몰 목록을 불러오지 못했습니다.');
      }

      const result = await response.json();
      setPartnerMalls(result.data || []);
    } catch (err) {
      console.error('Fetch partner malls error:', err);
      setError(err instanceof Error ? err.message : '파트너몰 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartnerMalls();
  }, [fetchPartnerMalls]);

  // Toggle partner mall active status
  const toggleActive = async (partnerMall: PartnerMall) => {
    try {
      setTogglingId(partnerMall.id);

      const response = await fetch('/api/admin/partner-malls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: partnerMall.id,
          is_active: !partnerMall.is_active,
        }),
      });

      if (!response.ok) {
        throw new Error('상태 변경에 실패했습니다.');
      }

      const result = await response.json();
      setPartnerMalls((prev) =>
        prev.map((p) => (p.id === partnerMall.id ? result.data : p))
      );
    } catch (err) {
      console.error('Toggle active error:', err);
      alert(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  // Delete partner mall
  const deletePartnerMall = async (partnerMall: PartnerMall) => {
    if (!confirm(`"${partnerMall.name}" 파트너몰을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setDeletingId(partnerMall.id);

      const response = await fetch(`/api/admin/partner-malls?id=${partnerMall.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다.');
      }

      setPartnerMalls((prev) => prev.filter((p) => p.id !== partnerMall.id));
    } catch (err) {
      console.error('Delete error:', err);
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle creator close
  const handleCreatorClose = () => {
    setShowCreator(false);
  };

  // Handle creation success
  const handleCreated = () => {
    setShowCreator(false);
    fetchPartnerMalls();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-gray-600">파트너몰 목록을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
        <button
          onClick={fetchPartnerMalls}
          className="mt-4 py-2 px-4 text-blue-600 hover:text-blue-800"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">파트너몰 관리</h1>
          <p className="text-gray-600 mt-1">
            파트너몰을 생성하고 제품에 로고를 적용하세요.
          </p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          파트너몰 생성
        </button>
      </div>

      {/* Empty state */}
      {partnerMalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg">
          <Building2 className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            파트너몰이 없습니다
          </h2>
          <p className="text-gray-500 mb-6">
            새로운 파트너몰을 생성하여 제품에 로고를 적용하세요.
          </p>
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            파트너몰 생성하기
          </button>
        </div>
      ) : (
        /* Partner mall list */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  로고
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  파트너몰명
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  제품 수
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  생성일
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {partnerMalls.map((mall) => (
                <tr key={mall.id} className="hover:bg-gray-50">
                  {/* Logo */}
                  <td className="px-4 py-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                      {mall.logo_url ? (
                        <img
                          src={mall.logo_url}
                          alt={mall.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{mall.name}</span>
                  </td>

                  {/* Product count */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Package className="w-4 h-4" />
                      <span>
                        {mall.partner_mall_products?.length || 0}개
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(mall)}
                      disabled={togglingId === mall.id}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                        mall.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {togglingId === mall.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : mall.is_active ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                      {mall.is_active ? '활성' : '비활성'}
                    </button>
                  </td>

                  {/* Created at */}
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {new Date(mall.created_at).toLocaleDateString('ko-KR')}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => deletePartnerMall(mall)}
                        disabled={deletingId === mall.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        {deletingId === mall.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Creator modal */}
      {showCreator && (
        <PartnerMallCreator onClose={handleCreatorClose} onCreated={handleCreated} />
      )}
    </div>
  );
}
