'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/lib/supabase-client';
import { Package, Settings, Users, BarChart3, Menu, X } from 'lucide-react';
import ProductsTab from '@/app/components/admin/ProductsTab';

type TabType = 'products' | 'orders' | 'users' | 'settings';

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, setUser, setLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
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

        // Fetch user profile with role
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

        // Check if user is admin
        if (profile.role !== 'admin') {
          router.push('/');
          return;
        }

        // Update auth store with role
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
        setLoading(false);
        setIsCheckingAuth(false);
      }
    };

    checkAdminAuth();
  }, [router, setUser, setLoading]);

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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">관리자 페이지</h1>
                <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              메인으로
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar overlay (mobile only) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] bg-white border-r border-gray-200 z-30
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            w-64
          `}
        >
          <nav className="p-4 space-y-1">
            <SidebarButton
              icon={Package}
              label="제품 관리"
              active={activeTab === 'products'}
              onClick={() => {
                setActiveTab('products');
                setSidebarOpen(false);
              }}
            />
            <SidebarButton
              icon={BarChart3}
              label="주문 관리"
              active={activeTab === 'orders'}
              onClick={() => {
                setActiveTab('orders');
                setSidebarOpen(false);
              }}
            />
            <SidebarButton
              icon={Users}
              label="사용자 관리"
              active={activeTab === 'users'}
              onClick={() => {
                setActiveTab('users');
                setSidebarOpen(false);
              }}
            />
            <SidebarButton
              icon={Settings}
              label="설정"
              active={activeTab === 'settings'}
              onClick={() => {
                setActiveTab('settings');
                setSidebarOpen(false);
              }}
            />
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 lg:ml-0">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'orders' && (
              <div className="bg-white rounded-lg p-8 text-center">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">주문 관리</h3>
                <p className="text-gray-500">주문 관리 기능은 준비 중입니다.</p>
              </div>
            )}
            {activeTab === 'users' && (
              <div className="bg-white rounded-lg p-8 text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">사용자 관리</h3>
                <p className="text-gray-500">사용자 관리 기능은 준비 중입니다.</p>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-lg p-8 text-center">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">설정</h3>
                <p className="text-gray-500">설정 기능은 준비 중입니다.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-colors
        ${
          active
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}
