'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Package, Users, BarChart3, Menu, X, ShoppingBag, MessageSquare, Factory, LayoutDashboard, Palette, Ticket, Building2 } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

type AdminRole = 'admin' | 'factory';

const navItems: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AdminRole[];
}> = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard, roles: ['admin'] },
  { href: '/products', label: '제품 관리', icon: Package, roles: ['admin'] },
  { href: '/designs', label: '디자인 관리', icon: Palette, roles: ['admin'] },
  { href: '/content', label: '콘텐츠 관리', icon: MessageSquare, roles: ['admin'] },
  { href: '/orders', label: '주문 관리', icon: BarChart3, roles: ['admin', 'factory'] },
  { href: '/factories', label: '공장 관리', icon: Factory, roles: ['admin'] },
  { href: '/cobuy', label: '공동구매 관리', icon: ShoppingBag, roles: ['admin'] },
  { href: '/partner_malls', label: '파트너몰 관리', icon: Building2, roles: ['admin'] },
  { href: '/coupons', label: '쿠폰 관리', icon: Ticket, roles: ['admin'] },
  { href: '/users', label: '사용자 관리', icon: Users, roles: ['admin', 'factory'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginRoute = pathname?.startsWith('/login') ?? false;
  const isPublicRoute = pathname?.startsWith('/shared/') ?? false;
  const skipAuth = isLoginRoute || isPublicRoute;

  const { authStatus, user, logout } = useAdminAuth({ skip: skipAuth });

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Skip layout for login and public routes
  if (skipAuth) {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (authStatus !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  const role = user?.role === 'admin' || user?.role === 'factory' ? user.role : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 h-16">
        <div className="h-full px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 truncate">관리자 페이지</h1>
              <p className="text-xs text-gray-500 truncate sm:hidden">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-gray-600 truncate max-w-[40ch]">
              {user?.email}
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`
            fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 z-30
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            w-64 overflow-y-auto
          `}
        >
          <nav className="p-3 space-y-1">
            {navItems
              .filter((item) => !role || item.roles.includes(role))
              .map((item) => (
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname === item.href || (pathname ?? '').startsWith(`${item.href}/`)}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 lg:ml-64">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors
        ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}
      `}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}
