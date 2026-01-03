'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Package, Settings, Users, BarChart3, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore } from '@/store/useAuthStore';

const navItems = [
  { href: '/products', label: '제품 관리', icon: Package },
  { href: '/orders', label: '주문 관리', icon: BarChart3 },
  { href: '/users', label: '사용자 관리', icon: Users },
  { href: '/settings', label: '설정', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, setUser, setLoading, logout } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginRoute = pathname?.startsWith('/login') ?? false;

  useEffect(() => {
    if (isLoginRoute) return;

    let isActive = true;

    const checkAdminAuth = async () => {
      setLoading(true);
      setIsCheckingAuth(true);
      try {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (!supabaseUser) {
          router.push('/login');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, email, phone_number')
          .eq('id', supabaseUser.id)
          .single();

        if (error || !profile) {
          console.error('Error fetching profile:', error);
          router.push('/login');
          return;
        }

        if (profile.role !== 'admin') {
          router.push('/login');
          return;
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email || profile.email || '',
          name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
          avatar_url: supabaseUser.user_metadata?.avatar_url,
          phone: supabaseUser.phone || profile.phone_number,
          role: profile.role,
        });
      } catch (error) {
        console.error('Error checking admin auth:', error);
        router.push('/login');
      } finally {
        if (isActive) {
          setLoading(false);
          setIsCheckingAuth(false);
        }
      }
    };

    checkAdminAuth();

    return () => {
      isActive = false;
    };
  }, [isLoginRoute, router, setUser, setLoading]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (isCheckingAuth || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">관리자 페이지</h1>
                <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
            fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] bg-white border-r border-gray-200 z-30
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            w-64
          `}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
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

        <main className="flex-1 p-6 lg:ml-0">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
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
        w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors
        ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}
      `}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}
