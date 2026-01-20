'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase-client';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { Edit2, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import type { AnnouncementRecord, AnnouncementFormState } from './types';
import {
  ANNOUNCEMENT_IMAGE_BUCKET,
  ANNOUNCEMENT_IMAGE_FOLDER,
  emptyAnnouncementForm,
  sortAnnouncements,
  formatDate,
} from './utils';

export default function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(emptyAnnouncementForm);
  const [announcementFormOpen, setAnnouncementFormOpen] = useState(false);
  const [announcementFormError, setAnnouncementFormError] = useState<string | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [uploadingAnnouncementImages, setUploadingAnnouncementImages] = useState(0);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/announcements');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공지 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setAnnouncements(sortAnnouncements(payload?.data || []));
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setAnnouncements([]);
      setError(err instanceof Error ? err.message : '공지 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnnouncementFormToggle = () => {
    setAnnouncementFormOpen((prev) => !prev);
    setAnnouncementFormError(null);
    if (announcementFormOpen) {
      setAnnouncementForm(emptyAnnouncementForm);
    }
  };

  const handleAnnouncementEdit = (announcement: AnnouncementRecord) => {
    setAnnouncementForm({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      is_published: Boolean(announcement.is_published),
      image_links: announcement.image_links || [],
    });
    setAnnouncementFormOpen(true);
    setAnnouncementFormError(null);
  };

  const handleAnnouncementImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setAnnouncementFormError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadingAnnouncementImages((prev) => prev + 1);
    setAnnouncementFormError(null);

    try {
      const supabase = createClient();
      const uploadResult = await uploadFileToStorage(
        supabase,
        file,
        ANNOUNCEMENT_IMAGE_BUCKET,
        ANNOUNCEMENT_IMAGE_FOLDER
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || '이미지 업로드에 실패했습니다.');
      }

      setAnnouncementForm((prev) => ({
        ...prev,
        image_links: [...prev.image_links, uploadResult.url ?? ''],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
      setAnnouncementFormError(message);
    } finally {
      setUploadingAnnouncementImages((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleAnnouncementImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach((file) => handleAnnouncementImageUpload(file));
    event.target.value = '';
  };

  const handleRemoveAnnouncementImage = (imageLink: string) => {
    setAnnouncementForm((prev) => ({
      ...prev,
      image_links: prev.image_links.filter((link) => link !== imageLink),
    }));
  };

  const handleAnnouncementSave = async () => {
    setAnnouncementFormError(null);

    if (uploadingAnnouncementImages > 0) {
      setAnnouncementFormError('이미지 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!announcementForm.title.trim()) {
      setAnnouncementFormError('제목을 입력해주세요.');
      return;
    }

    if (!announcementForm.content.trim()) {
      setAnnouncementFormError('내용을 입력해주세요.');
      return;
    }

    setSavingAnnouncement(true);
    setError(null);

    const payload = {
      id: announcementForm.id ?? undefined,
      title: announcementForm.title.trim(),
      content: announcementForm.content.trim(),
      is_published: announcementForm.is_published,
      image_links: announcementForm.image_links,
    };

    try {
      const response = await fetch('/api/admin/announcements', {
        method: announcementForm.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '공지 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedAnnouncement = responsePayload?.data as AnnouncementRecord;

      setAnnouncements((prev) => {
        const updated = announcementForm.id
          ? prev.map((item) => (item.id === savedAnnouncement.id ? savedAnnouncement : item))
          : [savedAnnouncement, ...prev];
        return sortAnnouncements(updated);
      });

      setAnnouncementForm(emptyAnnouncementForm);
      setAnnouncementFormOpen(false);
    } catch (err) {
      console.error('Error saving announcement:', err);
      setError(err instanceof Error ? err.message : '공지 저장에 실패했습니다.');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleAnnouncementDelete = async (announcementId: string) => {
    const confirmed = window.confirm('이 공지를 삭제할까요?');
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/announcements?id=${announcementId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공지 삭제에 실패했습니다.');
      }

      setAnnouncements((prev) => prev.filter((item) => item.id !== announcementId));
    } catch (err) {
      console.error('Error deleting announcement:', err);
      setError(err instanceof Error ? err.message : '공지 삭제에 실패했습니다.');
    }
  };

  const handleAnnouncementToggle = async (announcement: AnnouncementRecord) => {
    setError(null);
    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: announcement.id,
          is_published: !announcement.is_published,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '활성 상태 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedAnnouncement = payload?.data as AnnouncementRecord;
      setAnnouncements((prev) =>
        sortAnnouncements(prev.map((item) => (item.id === updatedAnnouncement.id ? updatedAnnouncement : item)))
      );
    } catch (err) {
      console.error('Error toggling announcement:', err);
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
            <h3 className="text-base font-semibold text-gray-900">공지 관리</h3>
            <p className="text-sm text-gray-500">여러 이미지를 포함한 공지를 등록하세요.</p>
          </div>
          <button
            onClick={handleAnnouncementFormToggle}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {announcementFormOpen ? '입력 닫기' : '새 공지 추가'}
          </button>
        </div>

        {announcementFormOpen && (
          <div className="bg-gray-50 rounded-md p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-gray-700">
                제목
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(event) =>
                    setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </label>
              <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                내용
                <textarea
                  value={announcementForm.content}
                  onChange={(event) =>
                    setAnnouncementForm((prev) => ({ ...prev, content: event.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </label>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <label className="space-y-2">
                이미지 업로드
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAnnouncementImageInputChange}
                  disabled={uploadingAnnouncementImages > 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                />
              </label>
              {uploadingAnnouncementImages > 0 && (
                <span className="text-xs text-gray-500">
                  이미지 {uploadingAnnouncementImages}개 업로드 중...
                </span>
              )}
              {announcementForm.image_links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {announcementForm.image_links.map((link, index) => (
                    <div
                      key={`${link}-${index}`}
                      className="relative w-20 h-20 overflow-hidden rounded-md border border-gray-200"
                    >
                      <img src={link} alt="공지 이미지" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveAnnouncementImage(link)}
                        type="button"
                        className="absolute top-1 right-1 bg-white/80 rounded-full p-0.5 text-xs text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={announcementForm.is_published}
                onChange={(event) =>
                  setAnnouncementForm((prev) => ({
                    ...prev,
                    is_published: event.target.checked,
                  }))
                }
                className="rounded border-gray-300"
              />
              공개 상태로 노출
            </label>

            {announcementFormError && (
              <p className="text-sm text-red-600">{announcementFormError}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setAnnouncementForm(emptyAnnouncementForm);
                  setAnnouncementFormOpen(false);
                  setAnnouncementFormError(null);
                }}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAnnouncementSave}
                disabled={savingAnnouncement || uploadingAnnouncementImages > 0}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingAnnouncement
                  ? '저장 중...'
                  : uploadingAnnouncementImages > 0
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
      ) : announcements.length === 0 ? (
        <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center text-gray-500">
          등록된 공지가 없습니다.
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
                    제목/내용
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작성일
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {announcements.map((announcement) => (
                  <tr key={announcement.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {announcement.image_links && announcement.image_links.length > 0 ? (
                        <img
                          src={announcement.image_links[0]}
                          alt={announcement.title}
                          className="w-16 h-16 object-cover rounded-md border border-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                          이미지 없음
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{announcement.title}</div>
                      <div className="text-xs text-gray-500 max-w-xs truncate">
                        {announcement.content}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleAnnouncementToggle(announcement)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          announcement.is_published
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {announcement.is_published ? (
                          <>
                            <Eye className="w-3 h-3" />
                            공개
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            비공개
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(announcement.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAnnouncementEdit(announcement)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          편집
                        </button>
                        <button
                          onClick={() => handleAnnouncementDelete(announcement.id)}
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
