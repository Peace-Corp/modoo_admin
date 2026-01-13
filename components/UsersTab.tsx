'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useMemo, useState, useEffect } from 'react';
import { Factory, Profile } from '@/types/types';
import { Users, Calendar, Shield, User as UserIcon, AlertCircle, Factory as FactoryIcon } from 'lucide-react';

export default function UsersTab() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingFactoryId, setUpdatingFactoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loadingFactories, setLoadingFactories] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [filterRole, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchFactories();
    } else {
      setFactories([]);
    }
  }, [currentUser?.role]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/admin/users?role=${filterRole}`;
      if (currentUser?.role === 'factory' && currentUser.manufacturer_id) {
        url += `&factoryId=${currentUser.manufacturer_id}`;
      }
      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '사용자 목록을 불러오는데 실패했습니다.');
      }

      const payload = await response.json();
      setUsers(payload?.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setError(error instanceof Error ? error.message : '사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'customer' | 'admin' | 'factory') => {
    setUpdatingUserId(userId);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '사용자 권한 변경에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedUser = payload?.data as Profile | undefined;
      const updatedRole = updatedUser?.role ?? newRole;
      const updatedManufacturerId = updatedUser?.manufacturer_id ?? null;

      setUsers((prev) => {
        if (filterRole !== 'all' && updatedRole !== filterRole) {
          return prev.filter((user) => user.id !== userId);
        }
        return prev.map((user) =>
          user.id === userId
            ? { ...user, role: updatedRole, manufacturer_id: updatedManufacturerId }
            : user
        );
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      setError(error instanceof Error ? error.message : '사용자 권한 변경에 실패했습니다.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const updateUserFactory = async (userId: string, factoryId: string | null) => {
    setUpdatingFactoryId(userId);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, factoryId }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || '공장 배정에 실패했습니다.');
      }

      const payload = await response.json();
      const updatedUser = payload?.data as Profile | undefined;
      const updatedManufacturerId = updatedUser?.manufacturer_id ?? factoryId;

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, manufacturer_id: updatedManufacturerId } : user
        )
      );
    } catch (error) {
      console.error('Error updating factory assignment:', error);
      setError(error instanceof Error ? error.message : '공장 배정에 실패했습니다.');
    } finally {
      setUpdatingFactoryId(null);
    }
  };

  const fetchFactories = async () => {
    setLoadingFactories(true);
    try {
      const response = await fetch('/api/admin/factories', { method: 'GET' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '공장 목록을 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setFactories(payload?.data || []);
    } catch (error) {
      console.error('Error fetching factories:', error);
      setFactories([]);
    } finally {
      setLoadingFactories(false);
    }
  };

  const getRoleColor = (role: string) => {
    if (role === 'admin') return 'bg-purple-100 text-purple-800';
    if (role === 'factory') return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return '관리자';
    if (role === 'factory') return '공장';
    return '일반 사용자';
  };

  const factoryMap = useMemo(() => {
    const map = new Map<string, Factory>();
    factories.forEach((factory) => map.set(factory.id, factory));
    return map;
  }, [factories]);

  const getFactoryName = (manufacturerId?: string | null) => {
    if (!manufacturerId) return '-';
    const factory = factoryMap.get(manufacturerId);
    if (factory?.name) return factory.name;
    if (currentUser?.role === 'factory' && currentUser.manufacturer_id === manufacturerId) {
      return currentUser.manufacturer_name || '-';
    }
    return '-';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">사용자 관리</h2>
          <p className="text-sm text-gray-500 mt-1">총 {users.length}명의 사용자</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      {currentUser?.role === 'admin' && (
        <div className="bg-white border border-gray-200/60 rounded-md p-3 shadow-sm">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: '전체' },
              { value: 'customer', label: '일반 사용자' },
              { value: 'factory', label: '공장' },
              { value: 'admin', label: '관리자' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterRole(filter.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterRole === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-gray-200/60 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사용자 ID
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  전화번호
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  권한
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  공장
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가입일
                </th>
                {currentUser?.role === 'admin' && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <div className="text-sm font-mono text-gray-600">{user.id.slice(0, 8)}...</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.phone_number || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                        user.role
                      )}`}
                    >
                      {user.role === 'admin' && <Shield className="w-3 h-3" />}
                      {user.role === 'factory' && <FactoryIcon className="w-3 h-3" />}
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {currentUser?.role === 'admin' && user.role === 'factory' ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={user.manufacturer_id || ''}
                          onChange={(event) =>
                            updateUserFactory(user.id, event.target.value || null)
                          }
                          disabled={loadingFactories || updatingFactoryId === user.id}
                          className="px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 disabled:opacity-50"
                        >
                          <option value="">공장 선택</option>
                          {factories.map((factory) => (
                            <option key={factory.id} value={factory.id}>
                              {factory.name}
                            </option>
                          ))}
                        </select>
                        {updatingFactoryId === user.id && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                            처리중...
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {getFactoryName(user.manufacturer_id)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-900">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(user.created_at)}
                    </div>
                  </td>
                  {currentUser?.role === 'admin' && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(event) =>
                              updateUserRole(
                                user.id,
                                event.target.value as 'customer' | 'admin' | 'factory'
                              )
                            }
                            disabled={updatingUserId === user.id}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 disabled:opacity-50"
                          >
                            <option value="customer">일반 사용자</option>
                            <option value="factory">공장</option>
                            <option value="admin">관리자</option>
                          </select>
                          {updatingUserId === user.id && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                              처리중...
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">사용자가 없습니다</h3>
            <p className="text-gray-500">등록된 사용자가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
