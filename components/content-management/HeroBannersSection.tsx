'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase-client';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { Edit2, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { HeroBannerRecord, HeroBannerFormState } from './types';
import {
  BANNER_IMAGE_BUCKET,
  BANNER_IMAGE_FOLDER,
  emptyHeroBannerForm,
  sortHeroBanners,
} from './utils';

export default function HeroBannersSection() {
  const [heroBanners, setHeroBanners] = useState<HeroBannerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerForm, setBannerForm] = useState<HeroBannerFormState>(emptyHeroBannerForm);
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [bannerFormError, setBannerFormError] = useState<string | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);

  useEffect(() => {
    fetchHeroBanners();
  }, []);

  const fetchHeroBanners = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/hero-banners');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '히어로 배너 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setHeroBanners(sortHeroBanners(payload?.data || []));
    } catch (err) {
      console.error('Error fetching hero banners:', err);
      setHeroBanners([]);
      setError(err instanceof Error ? err.message : '히어로 배너 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleBannerFormToggle = () => {
    setBannerFormOpen((prev) => !prev);
    setBannerFormError(null);
    if (bannerFormOpen) {
      setBannerForm(emptyHeroBannerForm);
    }
  };

  const handleBannerEdit = (banner: HeroBannerRecord) => {
    setBannerForm({
      id: banner.id,
      title: banner.title ?? '',
      subtitle: banner.subtitle ?? '',
      image_link: banner.image_link ?? '',
      redirect_link: banner.redirect_link ?? '',
      sort_order: banner.sort_order ?? 0,
      is_active: Boolean(banner.is_active),
    });
    setBannerFormOpen(true);
    setBannerFormError(null);
  };

  const handleBannerImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setBannerFormError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadingBannerImage(true);
    setBannerFormError(null);

    try {
      const supabase = createClient();
      const uploadResult = await uploadFileToStorage(
        supabase,
        file,
        BANNER_IMAGE_BUCKET,
        BANNER_IMAGE_FOLDER
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || '이미지 업로드에 실패했습니다.');
      }

      setBannerForm((prev) => ({ ...prev, image_link: uploadResult.url ?? '' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
      setBannerFormError(message);
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const handleBannerImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleBannerImageUpload(file);
    event.target.value = '';
  };

  const handleBannerSave = async () => {
    setBannerFormError(null);

    if (uploadingBannerImage) {
      setBannerFormError('이미지 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!bannerForm.title.trim()) {
      setBannerFormError('제목을 입력해주세요.');
      return;
    }

    if (!bannerForm.subtitle.trim()) {
      setBannerFormError('부제목을 입력해주세요.');
      return;
    }

    if (!bannerForm.image_link.trim()) {
      setBannerFormError('이미지 URL을 입력하거나 이미지를 업로드해주세요.');
      return;
    }

    setSavingBanner(true);
    setError(null);

    const payload = {
      id: bannerForm.id ?? undefined,
      title: bannerForm.title.trim(),
      subtitle: bannerForm.subtitle.trim(),
      image_link: bannerForm.image_link.trim(),
      redirect_link: bannerForm.redirect_link.trim() || null,
      sort_order: bannerForm.sort_order,
      is_active: bannerForm.is_active,
    };

    try {
      const response = await fetch('/api/admin/hero-banners', {
        method: bannerForm.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '히어로 배너 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedBanner = responsePayload?.data as HeroBannerRecord;

      setHeroBanners((prev) => {
        const updated = bannerForm.id
          ? prev.map((banner) => (banner.id === savedBanner.id ? savedBanner : banner))
          : [savedBanner, ...prev];
        return sortHeroBanners(updated);
      });

      setBannerForm(emptyHeroBannerForm);
      setBannerFormOpen(false);
    } catch (err) {
      console.error('Error saving hero banner:', err);
      setError(err instanceof Error ? err.message : '히어로 배너 저장에 실패했습니다.');
    } finally {
      setSavingBanner(false);
    }
  };

  const handleBannerDelete = async (bannerId: string) => {
    const confirmed = window.confirm('이 히어로 배너를 삭제할까요?');
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/hero-banners?id=${bannerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '히어로 배너 삭제에 실패했습니다.');
      }

      setHeroBanners((prev) => prev.filter((banner) => banner.id !== bannerId));
    } catch (err) {
      console.error('Error deleting hero banner:', err);
      setError(err instanceof Error ? err.message : '히어로 배너 삭제에 실패했습니다.');
    }
  };

  const handleBannerToggle = async (banner: HeroBannerRecord) => {
    setError(null);
    try {
      const response = await fetch('/api/admin/hero-banners', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: banner.id,
          is_active: !banner.is_active,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '활성 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedBanner = payload?.data as HeroBannerRecord;
      setHeroBanners((prev) =>
        sortHeroBanners(prev.map((item) => (item.id === updatedBanner.id ? updatedBanner : item)))
      );
    } catch (err) {
      console.error('Error toggling hero banner:', err);
      setError(err instanceof Error ? err.message : '활성 상태 변경에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">히어로 배너 관리</h3>
            <p className="text-sm text-gray-500">홈 화면에 노출할 배너를 등록하세요.</p>
          </div>
          <button
            onClick={handleBannerFormToggle}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {bannerFormOpen ? '입력 닫기' : '새 배너 추가'}
          </button>
        </div>

        {bannerFormOpen && (
          <div className="bg-gray-50 rounded-md p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                제목
                <input
                  type="text"
                  value={bannerForm.title}
                  onChange={(event) =>
                    setBannerForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700">
                부제목
                <input
                  type="text"
                  value={bannerForm.subtitle}
                  onChange={(event) =>
                    setBannerForm((prev) => ({ ...prev, subtitle: event.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>
            </div>
            <label className="space-y-2 text-sm text-gray-700">
              링크 URL
              <input
                type="text"
                value={bannerForm.redirect_link}
                onChange={(event) =>
                  setBannerForm((prev) => ({ ...prev, redirect_link: event.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-3 text-sm text-gray-700 md:col-span-2">
                <label className="space-y-2 text-sm text-gray-700">
                  이미지 URL
                  <input
                    type="text"
                    value={bannerForm.image_link}
                    onChange={(event) =>
                      setBannerForm((prev) => ({ ...prev, image_link: event.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </label>
                <label className="space-y-2 text-sm text-gray-700">
                  이미지 업로드
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerImageInputChange}
                    disabled={uploadingBannerImage}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  />
                  {uploadingBannerImage && (
                    <span className="text-xs text-gray-500">업로드 중...</span>
                  )}
                </label>
              </div>
              <label className="space-y-2 text-sm text-gray-700">
                정렬 순서
                <input
                  type="number"
                  value={bannerForm.sort_order}
                  onChange={(event) =>
                    setBannerForm((prev) => ({
                      ...prev,
                      sort_order: Number(event.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={bannerForm.is_active}
                onChange={(event) =>
                  setBannerForm((prev) => ({ ...prev, is_active: event.target.checked }))
                }
                className="rounded border-gray-300"
              />
              활성 상태로 노출
            </label>

            {bannerFormError && <p className="text-sm text-red-600">{bannerFormError}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setBannerForm(emptyHeroBannerForm);
                  setBannerFormOpen(false);
                  setBannerFormError(null);
                }}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleBannerSave}
                disabled={savingBanner || uploadingBannerImage}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingBanner
                  ? '저장 중...'
                  : uploadingBannerImage
                    ? '이미지 업로드 중...'
                    : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : heroBanners.length === 0 ? (
        <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
          등록된 히어로 배너가 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이미지
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제목
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    링크
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    정렬
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
                {heroBanners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {banner.image_link ? (
                        <img
                          src={banner.image_link}
                          alt={banner.title}
                          className="w-16 h-16 object-cover rounded-md border border-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                          이미지 없음
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{banner.title}</div>
                      <div className="text-xs text-gray-500 max-w-xs truncate">
                        {banner.subtitle}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {banner.redirect_link ? (
                        <a
                          href={banner.redirect_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          링크 열기
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">링크 없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{banner.sort_order}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleBannerToggle(banner)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          banner.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {banner.is_active ? (
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
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleBannerEdit(banner)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          편집
                        </button>
                        <button
                          onClick={() => handleBannerDelete(banner.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
