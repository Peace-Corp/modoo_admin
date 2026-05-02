/** DB enum 및 레거시 표기(super-admin 등)를 앱 표준 형태로 통일합니다. */
export type ProfileRole = 'admin' | 'factory' | 'super_admin' | 'customer';

export function normalizeProfileRole(role: string | null | undefined): ProfileRole | null {
  if (!role || typeof role !== 'string') return null;
  const r = role.trim().toLowerCase().replace(/-/g, '_');
  if (r === 'superadmin' || r === 'super_admin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'factory') return 'factory';
  if (r === 'customer') return 'customer';
  return null;
}

export function isAdminLike(role: string | null | undefined): boolean {
  const n = normalizeProfileRole(role);
  return n === 'admin' || n === 'super_admin';
}

/** 관리자 화면(대시보드 등) 접근 가능한 역할 */
export function isBackofficeOperatorRole(role: string | null | undefined): boolean {
  const n = normalizeProfileRole(role);
  return n === 'admin' || n === 'factory' || n === 'super_admin';
}
