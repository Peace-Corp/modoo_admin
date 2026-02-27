'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Package, Users, BarChart3, Menu, X, ShoppingBag, MessageSquare, Factory, LayoutDashboard, Palette, Ticket, Building2, ChevronDown } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

type AdminRole = 'admin' | 'factory';

type NavLink = {
  type: 'link';
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AdminRole[];
};

type NavChild = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  type: 'section';
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  roles: AdminRole[];
  children: NavChild[];
};

type NavItem = NavLink | NavSection;

const navItems: NavItem[] = [
  { type: 'link', href: '/dashboard', label: '대시보드', icon: LayoutDashboard, roles: ['admin'] },
  { type: 'link', href: '/products', label: '제품 관리', icon: Package, roles: ['admin'] },
  { type: 'link', href: '/designs', label: '디자인 관리', icon: Palette, roles: ['admin'] },
  {
    type: 'section',
    label: '콘텐츠',
    icon: MessageSquare,
    roles: ['admin'],
    children: [
      { href: '/content/reviews', label: '리뷰' },
      { href: '/content/examples', label: '제작 사례' },
      { href: '/content/banners', label: '히어로 배너' },
      { href: '/content/announcements', label: '공지' },
      { href: '/content/faqs', label: 'FAQ' },
      { href: '/content/inquiries', label: '문의' },
      { href: '/content/chatbot', label: '챗봇 문의' },
    ],
  },
  { type: 'link', href: '/orders', label: '주문 관리', icon: BarChart3, roles: ['admin', 'factory'] },
  { type: 'link', href: '/factories', label: '공장 관리', icon: Factory, roles: ['admin'] },
  {
    type: 'section',
    label: '공동구매',
    icon: ShoppingBag,
    roles: ['admin'],
    children: [
      { href: '/cobuy/requests', label: '요청 관리' },
      { href: '/cobuy/sessions', label: '세션 관리' },
    ],
  },
  { type: 'link', href: '/partner_malls', label: '파트너몰 관리', icon: Building2, roles: ['admin'] },
  { type: 'link', href: '/coupons', label: '쿠폰 관리', icon: Ticket, roles: ['admin'] },
  { type: 'link', href: '/users', label: '사용자 관리', icon: Users, roles: ['admin', 'factory'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginRoute = pathname?.startsWith('/login') ?? false;
  const isPublicRoute = pathname?.startsWith('/shared/') ?? false;
  const isEditorRoute = pathname?.startsWith('/editor') ?? false;
  const skipAuth = isLoginRoute || isPublicRoute;
  const skipLayout = skipAuth || isEditorRoute;

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

  // Full-screen layout for editor (auth checked, no sidebar)
  if (isEditorRoute) {
    return <>{children}</>;
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
            className="fixed inset-0 bg-black/20 bg-opacity-50 z-20 lg:hidden"
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
              .map((item) =>
                item.type === 'section' ? (
                  <SidebarSection
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    pathname={pathname}
                    onLinkClick={() => setSidebarOpen(false)}
                    children={item.children}
                  />
                ) : (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={pathname === item.href || (pathname ?? '').startsWith(`${item.href}/`)}
                    onClick={() => setSidebarOpen(false)}
                  />
                )
            )}
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
  icon?: React.ComponentType<{ className?: string }>;
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
      {Icon && <Icon className="w-5 h-5" />}
      {label}
    </Link>
  );
}

function SidebarSection({
  label,
  icon: Icon,
  children,
  pathname,
  onLinkClick,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: NavChild[];
  pathname: string | null;
  onLinkClick: () => void;
}) {
  const hasActiveChild = children.some(
    (child) => pathname === child.href || (pathname ?? '').startsWith(`${child.href}/`)
  );
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          hasActiveChild ? 'text-blue-700' : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        {Icon && <Icon className="w-5 h-5" />}
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 mt-0.5">
          {children.map((child) => (
            <SidebarLink
              key={child.href}
              href={child.href}
              icon={child.icon}
              label={child.label}
              active={pathname === child.href || (pathname ?? '').startsWith(`${child.href}/`)}
              onClick={onLinkClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
