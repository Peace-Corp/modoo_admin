'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Factory, Profile } from '@/types/types';
import {
  AlertCircle,
  Factory as FactoryIcon,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react';

const sortFactories = (items: Factory[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const emptyForm = {
  name: '',
  email: '',
  phone_number: '',
  is_active: true,
};

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

  useEffect(() => {
    fetchFactories();
    fetchFactoryUsers();
  }, []);

  const unassignedFactoryUsers = useMemo(
    () => factoryUsers.filter((user) => !user.factory_id),
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
      const nextFactoryId = updatedUser?.factory_id ?? factoryId;

      setFactoryUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, factory_id: nextFactoryId } : user
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">공장 관리</h2>
          <p className="text-gray-500 mt-1">총 {factories.length}개의 공장</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <FactoryIcon className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">새 공장 등록</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm text-gray-700">
            공장명
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            이메일
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {creating ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공장명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  전화번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  소속 사용자
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
              {factories.map((factory) => {
                const isEditing = editingId === factory.id;
                const isUpdating = updatingFactoryId === factory.id;
                const isExpanded = expandedFactoryId === factory.id;
                const members = factoryUsers.filter((user) => user.factory_id === factory.id);

                return (
                  <Fragment key={factory.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft?.name || ''}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, name: event.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{factory.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editDraft?.email || ''}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, email: event.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{factory.email || '-'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft?.phone_number || ''}
                            onChange={(event) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, phone_number: event.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">
                            {factory.phone_number || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleEditSave(factory.id)}
                                disabled={isUpdating}
                                className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                {isUpdating ? '저장 중...' : '저장'}
                              </button>
                              <button
                                onClick={handleEditCancel}
                                disabled={isUpdating}
                                className="inline-flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditStart(factory)}
                                className="inline-flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                편집
                              </button>
                              <button
                                onClick={() =>
                                  setExpandedFactoryId((prev) =>
                                    prev === factory.id ? null : factory.id
                                  )
                                }
                                className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                        <td colSpan={6} className="px-6 py-4">
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
                                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
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

                            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
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
                                  className="min-w-[220px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white disabled:opacity-50"
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
                                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
