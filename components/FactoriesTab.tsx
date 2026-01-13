'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Factory, ManufacturerColor, Profile } from '@/types/types';
import {
  AlertCircle,
  ArrowLeft,
  Factory as FactoryIcon,
  Palette,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from 'lucide-react';

const sortFactories = (items: Factory[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const sortColors = (items: ManufacturerColor[]) =>
  [...items].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, 'ko');
  });

const emptyForm = {
  name: '',
  email: '',
  phone_number: '',
  is_active: true,
};

const emptyColorForm = {
  name: '',
  hex: '#000000',
  color_code: '',
  label: '',
  is_active: true,
  sort_order: 0,
};

interface ManufacturerColorsEditorProps {
  factory: Factory;
  onBack: () => void;
}

function ManufacturerColorsEditor({ factory, onBack }: ManufacturerColorsEditorProps) {
  const [colors, setColors] = useState<ManufacturerColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyColorForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<typeof emptyColorForm | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchColors();
  }, [factory.id]);

  const fetchColors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/manufacturer-colors?manufacturerId=${factory.id}&includeInactive=true`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '색상 목록을 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setColors(sortColors(payload?.data || []));
    } catch (err) {
      console.error('Error fetching colors:', err);
      setColors([]);
      setError(err instanceof Error ? err.message : '색상 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const createColor = async () => {
    if (!form.name.trim()) {
      setError('색상명을 입력해주세요.');
      return;
    }
    if (!form.hex.trim()) {
      setError('HEX 색상 코드를 입력해주세요.');
      return;
    }
    if (!form.color_code.trim()) {
      setError('색상 코드를 입력해주세요.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/manufacturer-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer_id: factory.id,
          name: form.name.trim(),
          hex: form.hex.trim(),
          color_code: form.color_code.trim(),
          label: form.label.trim() || null,
          is_active: form.is_active,
          sort_order: form.sort_order,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '색상 생성에 실패했습니다.');
      }

      const payload = await response.json();
      const created = payload?.data as ManufacturerColor;
      setColors((prev) => sortColors([created, ...prev]));
      setForm(emptyColorForm);
    } catch (err) {
      console.error('Error creating color:', err);
      setError(err instanceof Error ? err.message : '색상 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const updateColor = async (colorId: string, updates: Partial<ManufacturerColor>) => {
    setUpdatingId(colorId);
    setError(null);
    try {
      const response = await fetch('/api/admin/manufacturer-colors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: colorId, ...updates }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '색상 업데이트에 실패했습니다.');
      }

      const payload = await response.json();
      const updated = payload?.data as ManufacturerColor;
      setColors((prev) => sortColors(prev.map((c) => (c.id === updated.id ? updated : c))));
      return updated;
    } catch (err) {
      console.error('Error updating color:', err);
      setError(err instanceof Error ? err.message : '색상 업데이트에 실패했습니다.');
      return null;
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteColor = async (colorId: string) => {
    const color = colors.find((c) => c.id === colorId);
    const confirmed = window.confirm(`"${color?.name}" 색상을 삭제할까요?`);
    if (!confirmed) return;

    setDeletingId(colorId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/manufacturer-colors?id=${colorId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '색상 삭제에 실패했습니다.');
      }

      setColors((prev) => prev.filter((c) => c.id !== colorId));
    } catch (err) {
      console.error('Error deleting color:', err);
      setError(err instanceof Error ? err.message : '색상 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditStart = (color: ManufacturerColor) => {
    setEditingId(color.id);
    setEditDraft({
      name: color.name,
      hex: color.hex,
      color_code: color.color_code,
      label: color.label ?? '',
      is_active: color.is_active ?? true,
      sort_order: color.sort_order ?? 0,
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleEditSave = async (colorId: string) => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) {
      setError('색상명을 입력해주세요.');
      return;
    }

    const updated = await updateColor(colorId, {
      name: editDraft.name.trim(),
      hex: editDraft.hex.trim(),
      color_code: editDraft.color_code.trim(),
      label: editDraft.label.trim() || null,
      is_active: editDraft.is_active,
      sort_order: editDraft.sort_order,
    });

    if (updated) {
      setEditingId(null);
      setEditDraft(null);
    }
  };

  const handleToggleActive = async (color: ManufacturerColor) => {
    await updateColor(color.id, { is_active: !color.is_active });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{factory.name} - 색상 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {colors.length}개의 색상</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">새 색상 등록</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <label className="space-y-2 text-sm text-gray-700">
            색상명 *
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="예: 네이비"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            HEX 코드 *
            <div className="flex gap-2">
              <input
                type="color"
                value={form.hex}
                onChange={(e) => setForm((prev) => ({ ...prev, hex: e.target.value }))}
                className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
              />
              <input
                type="text"
                value={form.hex}
                onChange={(e) => setForm((prev) => ({ ...prev, hex: e.target.value }))}
                placeholder="#000000"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            색상 코드 *
            <input
              type="text"
              value={form.color_code}
              onChange={(e) => setForm((prev) => ({ ...prev, color_code: e.target.value }))}
              placeholder="예: NV001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            라벨
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="표시용 라벨"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            정렬 순서
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            활성 상태로 등록
          </label>
          <button
            onClick={createColor}
            disabled={creating}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {creating ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  색상
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  색상명
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  HEX
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  색상 코드
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  라벨
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  순서
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
              {colors.map((color) => {
                const isEditing = editingId === color.id;
                const isUpdating = updatingId === color.id;
                const isDeleting = deletingId === color.id;

                return (
                  <tr key={color.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="color"
                          value={editDraft?.hex || '#000000'}
                          onChange={(e) =>
                            setEditDraft((prev) => (prev ? { ...prev, hex: e.target.value } : prev))
                          }
                          className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: color.hex }}
                          title={color.hex}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft?.name || ''}
                          onChange={(e) =>
                            setEditDraft((prev) =>
                              prev ? { ...prev, name: e.target.value } : prev
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{color.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft?.hex || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => (prev ? { ...prev, hex: e.target.value } : prev))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 font-mono">{color.hex}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft?.color_code || ''}
                          onChange={(e) =>
                            setEditDraft((prev) =>
                              prev ? { ...prev, color_code: e.target.value } : prev
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{color.color_code}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft?.label || ''}
                          onChange={(e) =>
                            setEditDraft((prev) =>
                              prev ? { ...prev, label: e.target.value } : prev
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{color.label || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editDraft?.sort_order || 0}
                          onChange={(e) =>
                            setEditDraft((prev) =>
                              prev ? { ...prev, sort_order: parseInt(e.target.value) || 0 } : prev
                            )
                          }
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{color.sort_order ?? 0}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(color)}
                        disabled={isUpdating}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          color.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {color.is_active ? (
                          <>
                            <ToggleRight className="w-3 h-3" />
                            활성
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-3 h-3" />
                            비활성
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleEditSave(color.id)}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                              {isUpdating ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={handleEditCancel}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditStart(color)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              편집
                            </button>
                            <button
                              onClick={() => deleteColor(color.id)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              {isDeleting ? '삭제 중...' : '삭제'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {colors.length === 0 && (
          <div className="text-center py-12">
            <Palette className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">등록된 색상이 없습니다</h3>
            <p className="text-gray-500">새 색상을 등록해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FactoriesTab() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [factoryUsers, setFactoryUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Omit<typeof emptyForm, 'is_active'> | null>(null);
  const [updatingFactoryId, setUpdatingFactoryId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [expandedFactoryId, setExpandedFactoryId] = useState<string | null>(null);
  const [selectedUserByFactory, setSelectedUserByFactory] = useState<Record<string, string>>({});

  // Color management view state
  const [selectedFactoryForColors, setSelectedFactoryForColors] = useState<Factory | null>(null);

  useEffect(() => {
    fetchFactories();
    fetchFactoryUsers();
  }, []);

  const unassignedFactoryUsers = useMemo(
    () => factoryUsers.filter((user) => !user.manufacturer_id),
    [factoryUsers]
  );

  const fetchFactories = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/factories');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 목록을 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setFactories(sortFactories(payload?.data || []));
    } catch (err) {
      console.error('Error fetching factories:', err);
      setFactories([]);
      setError(err instanceof Error ? err.message : '공장 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFactoryUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/admin/users?role=factory');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 사용자 목록을 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setFactoryUsers(payload?.data || []);
    } catch (err) {
      console.error('Error fetching factory users:', err);
      setFactoryUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const createFactory = async () => {
    if (!form.name.trim()) {
      setError('공장명을 입력해주세요.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/factories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone_number: form.phone_number.trim() || null,
          is_active: form.is_active,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 생성에 실패했습니다.');
      }

      const payload = await response.json();
      const created = payload?.data as Factory;
      setFactories((prev) => sortFactories([created, ...prev]));
      setForm(emptyForm);
    } catch (err) {
      console.error('Error creating factory:', err);
      setError(err instanceof Error ? err.message : '공장 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const updateFactory = async (factoryId: string, updates: Partial<Factory>) => {
    setUpdatingFactoryId(factoryId);
    setError(null);
    try {
      const response = await fetch('/api/admin/factories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: factoryId, ...updates }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 업데이트에 실패했습니다.');
      }

      const payload = await response.json();
      const updated = payload?.data as Factory;
      setFactories((prev) =>
        sortFactories(prev.map((factory) => (factory.id === updated.id ? updated : factory)))
      );
      return updated;
    } catch (err) {
      console.error('Error updating factory:', err);
      setError(err instanceof Error ? err.message : '공장 업데이트에 실패했습니다.');
      return null;
    } finally {
      setUpdatingFactoryId(null);
    }
  };

  const handleEditStart = (factory: Factory) => {
    setEditingId(factory.id);
    setEditDraft({
      name: factory.name,
      email: factory.email ?? '',
      phone_number: factory.phone_number ?? '',
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleEditSave = async (factoryId: string) => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) {
      setError('공장명을 입력해주세요.');
      return;
    }

    const updated = await updateFactory(factoryId, {
      name: editDraft.name.trim(),
      email: editDraft.email.trim() || null,
      phone_number: editDraft.phone_number.trim() || null,
    });

    if (updated) {
      setEditingId(null);
      setEditDraft(null);
    }
  };

  const handleToggleActive = async (factory: Factory) => {
    if (factory.is_active) {
      const confirmed = window.confirm(`"${factory.name}" 공장을 비활성화할까요?`);
      if (!confirmed) return;
    }

    await updateFactory(factory.id, { is_active: !factory.is_active });
  };

  const updateUserFactory = async (userId: string, factoryId: string | null) => {
    setUpdatingUserId(userId);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, factoryId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 사용자 업데이트에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedUser = payload?.data as Profile | undefined;
      const nextManufacturerId = updatedUser?.manufacturer_id ?? factoryId;

      setFactoryUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, manufacturer_id: nextManufacturerId } : user
        )
      );
      return updatedUser ?? null;
    } catch (err) {
      console.error('Error updating factory user:', err);
      setError(err instanceof Error ? err.message : '공장 사용자 업데이트에 실패했습니다.');
      return null;
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAssignUser = async (factoryId: string) => {
    const selectedUserId = selectedUserByFactory[factoryId];
    if (!selectedUserId) return;

    const updated = await updateUserFactory(selectedUserId, factoryId);
    if (updated) {
      setSelectedUserByFactory((prev) => ({ ...prev, [factoryId]: '' }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show color management view when a factory is selected
  if (selectedFactoryForColors) {
    return (
      <ManufacturerColorsEditor
        factory={selectedFactoryForColors}
        onBack={() => setSelectedFactoryForColors(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">공장 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {factories.length}개의 공장</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <FactoryIcon className="w-5 h-5 text-gray-600" />
          <h3 className="text-base font-semibold text-gray-900">새 공장 등록</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm text-gray-700">
            공장명
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            이메일
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            전화번호
            <input
              type="text"
              value={form.phone_number}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone_number: event.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            className="rounded border-gray-300"
          />
          활성 상태로 등록
        </label>
        <div className="flex justify-end">
          <button
            onClick={createFactory}
            disabled={creating}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {creating ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공장명
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  전화번호
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  소속 사용자
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
              {factories.map((factory) => {
                const isEditing = editingId === factory.id;
                const isUpdating = updatingFactoryId === factory.id;
                const isExpanded = expandedFactoryId === factory.id;
                const members = factoryUsers.filter((user) => user.manufacturer_id === factory.id);

                return (
                  <Fragment key={factory.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft?.name || ''}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, name: event.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{factory.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editDraft?.email || ''}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, email: event.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{factory.email || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft?.phone_number || ''}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, phone_number: event.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">
                            {factory.phone_number || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() =>
                            setExpandedFactoryId((prev) => (prev === factory.id ? null : factory.id))
                          }
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <Users className="w-4 h-4" />
                          {members.length}명
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(factory)}
                          disabled={isUpdating}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            factory.is_active
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {factory.is_active ? (
                            <>
                              <ToggleRight className="w-3 h-3" />
                              활성
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-3 h-3" />
                              비활성
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleEditSave(factory.id)}
                                disabled={isUpdating}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                {isUpdating ? '저장 중...' : '저장'}
                              </button>
                              <button
                                onClick={handleEditCancel}
                                disabled={isUpdating}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditStart(factory)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                              >
                                편집
                              </button>
                              <button
                                onClick={() => setSelectedFactoryForColors(factory)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                              >
                                <Palette className="w-4 h-4" />
                                색상 관리
                              </button>
                              <button
                                onClick={() =>
                                  setExpandedFactoryId((prev) =>
                                    prev === factory.id ? null : factory.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                              >
                                사용자 관리
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  공장 사용자
                                </span>
                              </div>
                              {loadingUsers && (
                                <span className="text-xs text-gray-500">불러오는 중...</span>
                              )}
                            </div>

                            <div className="grid gap-2">
                              {members.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                  배정된 사용자가 없습니다.
                                </p>
                              ) : (
                                members.map((member) => (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {member.email || member.id}
                                      </p>
                                      <p className="text-xs text-gray-500">{member.id}</p>
                                    </div>
                                    <button
                                      onClick={() => updateUserFactory(member.id, null)}
                                      disabled={updatingUserId === member.id}
                                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                                    >
                                      {updatingUserId === member.id ? '해제 중...' : '해제'}
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="rounded-md border border-gray-200 bg-white p-3 space-y-3">
                              <p className="text-sm font-medium text-gray-700">
                                공장 사용자 배정
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <select
                                  value={selectedUserByFactory[factory.id] || ''}
                                  onChange={(event) =>
                                    setSelectedUserByFactory((prev) => ({
                                      ...prev,
                                      [factory.id]: event.target.value,
                                    }))
                                  }
                                  disabled={loadingUsers || unassignedFactoryUsers.length === 0}
                                  className="min-w-[220px] px-3 py-2 text-sm border border-gray-300 rounded-md bg-white disabled:opacity-50"
                                >
                                  <option value="">
                                    {unassignedFactoryUsers.length === 0
                                      ? '배정 가능한 사용자 없음'
                                      : '사용자 선택'}
                                  </option>
                                  {unassignedFactoryUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.email || user.id}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssignUser(factory.id)}
                                  disabled={
                                    !selectedUserByFactory[factory.id] ||
                                    loadingUsers ||
                                    updatingUserId !== null
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                  <Plus className="w-4 h-4" />
                                  배정
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {factories.length === 0 && (
          <div className="text-center py-12">
            <FactoryIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">등록된 공장이 없습니다</h3>
            <p className="text-gray-500">새 공장을 등록해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
