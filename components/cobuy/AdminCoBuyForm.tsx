'use client';

import { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Trash2,
  Search,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Product, CoBuyCustomField, CoBuyPricingTier, CoBuySession } from '@/types/types';
import CustomFieldBuilder from './CustomFieldBuilder';

interface AdminCoBuyFormProps {
  product: Product;
  savedDesignId: string;
  onSuccess: (session: CoBuySession) => void;
  onBack: () => void;
}

interface UserSearchResult {
  id: string;
  email: string;
  phone_number: string | null;
}

export default function AdminCoBuyForm({
  product,
  savedDesignId,
  onSuccess,
  onBack,
}: AdminCoBuyFormProps) {
  // Basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [receiveByDate, setReceiveByDate] = useState('');

  // Quantity settings
  const [minQuantity, setMinQuantity] = useState<string>('');
  const [maxQuantity, setMaxQuantity] = useState<string>('');

  // Pricing tiers
  const [pricingTiers, setPricingTiers] = useState<CoBuyPricingTier[]>([
    { minQuantity: 10, pricePerItem: 25000 },
    { minQuantity: 30, pricePerItem: 22000 },
    { minQuantity: 50, pricePerItem: 20000 },
    { minQuantity: 100, pricePerItem: 18000 },
  ]);

  // Custom fields
  const [customFields, setCustomFields] = useState<CoBuyCustomField[]>([]);

  // User linking
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize custom fields with size field
  useEffect(() => {
    const sizeOptions = product.size_options || [];
    const sizeField: CoBuyCustomField = {
      id: 'size',
      type: 'dropdown',
      label: '사이즈',
      required: true,
      fixed: true,
      options: sizeOptions,
    };
    setCustomFields([sizeField]);
  }, [product.size_options]);

  // Set default dates
  useEffect(() => {
    const now = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const formatDate = (date: Date) => {
      return date.toISOString().slice(0, 16);
    };

    setStartDate(formatDate(now));
    setEndDate(formatDate(oneWeekLater));
    setReceiveByDate(formatDate(twoWeeksLater));
  }, []);

  const handleUserSearch = async () => {
    if (!userSearchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const response = await fetch(
        `/api/admin/users/search?q=${encodeURIComponent(userSearchQuery)}`
      );

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      setSearchResults(data.data || []);

      if (data.data?.length === 0) {
        setSearchError('검색 결과가 없습니다');
      }
    } catch (error) {
      console.error('User search error:', error);
      setSearchError('사용자 검색에 실패했습니다');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchResults([]);
    setUserSearchQuery('');
  };

  const handleRemoveUser = () => {
    setSelectedUser(null);
  };

  const addPricingTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const newQuantity = lastTier ? lastTier.minQuantity + 50 : 10;
    const newPrice = lastTier ? Math.max(10000, lastTier.pricePerItem - 2000) : 25000;

    setPricingTiers([
      ...pricingTiers,
      { minQuantity: newQuantity, pricePerItem: newPrice },
    ]);
  };

  const updatePricingTier = (index: number, field: 'minQuantity' | 'pricePerItem', value: number) => {
    const updated = [...pricingTiers];
    updated[index] = { ...updated[index], [field]: value };
    // Sort by quantity
    updated.sort((a, b) => a.minQuantity - b.minQuantity);
    setPricingTiers(updated);
  };

  const removePricingTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    if (!startDate || !endDate) {
      setError('시작일과 종료일을 입력해주세요');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('종료일은 시작일보다 이후여야 합니다');
      return;
    }
    if (!selectedUser) {
      setError('공동구매를 연결할 사용자를 선택해주세요');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/cobuy/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          savedDesignId,
          userId: selectedUser.id,
          title: title.trim(),
          description: description.trim() || null,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          receiveByDate: receiveByDate ? new Date(receiveByDate).toISOString() : null,
          minQuantity: minQuantity ? parseInt(minQuantity) : null,
          maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
          pricingTiers,
          customFields,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create CoBuy session');
      }

      const data = await response.json();
      onSuccess(data.data);
    } catch (error) {
      console.error('Error creating CoBuy:', error);
      setError(error instanceof Error ? error.message : '공동구매 생성에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* User Selection Section */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            사용자 연결 (필수)
          </h3>
          <p className="text-sm text-blue-700 mb-4">
            이 공동구매를 관리할 사용자를 선택해주세요. 선택된 사용자가 공동구매의 주최자가 됩니다.
          </p>

          {selectedUser ? (
            <div className="bg-white border border-blue-300 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">{selectedUser.email}</p>
                  {selectedUser.phone_number && (
                    <p className="text-sm text-gray-500">{selectedUser.phone_number}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleRemoveUser}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
                    placeholder="이메일로 사용자 검색..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleUserSearch}
                  disabled={isSearching || !userSearchQuery.trim()}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  {isSearching ? '검색 중...' : '검색'}
                </button>
              </div>

              {searchError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {searchError}
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="bg-white border rounded-lg divide-y max-h-48 overflow-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium text-gray-900">{user.email}</p>
                      {user.phone_number && (
                        <p className="text-sm text-gray-500">{user.phone_number}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Basic Info Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              공동구매 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2024 신입생 단체 티셔츠"
              maxLength={100}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="공동구매에 대한 설명을 입력하세요"
              maxLength={500}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </section>

        {/* Dates Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            일정
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              수령 예정일 (선택)
            </label>
            <input
              type="datetime-local"
              value={receiveByDate}
              onChange={(e) => setReceiveByDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </section>

        {/* Quantity Settings Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">수량 설정</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최소 수량 (선택)
              </label>
              <input
                type="number"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="예: 10"
                min={1}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최대 수량 (선택)
              </label>
              <input
                type="number"
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                placeholder="무제한"
                min={1}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Pricing Tiers Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">가격 구간</h3>
          <p className="text-sm text-gray-600">
            수량에 따른 개당 가격을 설정하세요. 수량이 많을수록 저렴하게 설정하는 것이 일반적입니다.
          </p>

          <div className="space-y-3">
            {pricingTiers.map((tier, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={tier.minQuantity}
                      onChange={(e) => updatePricingTier(index, 'minQuantity', parseInt(e.target.value) || 0)}
                      min={1}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      벌 이상
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={tier.pricePerItem}
                      onChange={(e) => updatePricingTier(index, 'pricePerItem', parseInt(e.target.value) || 0)}
                      min={0}
                      step={1000}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      원
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removePricingTier(index)}
                  disabled={pricingTiers.length <= 1}
                  className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addPricingTier}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            가격 구간 추가
          </button>
        </section>

        {/* Custom Fields Section */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">참여자 정보 수집</h3>
          <p className="text-sm text-gray-600">
            참여자로부터 수집할 정보를 설정하세요. 사이즈는 기본으로 포함됩니다.
          </p>

          <CustomFieldBuilder
            fields={customFields}
            onChange={setCustomFields}
            maxFields={10}
          />
        </section>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 border-t">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                생성 중...
              </>
            ) : (
              '공동구매 생성하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
