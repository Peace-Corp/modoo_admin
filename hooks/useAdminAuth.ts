'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useAuthStore, type AuthStatus, type UserData } from '@/store/useAuthStore';

type AdminRole = 'admin' | 'factory';

const allowedRoutesByRole: Record<AdminRole, string[]> = {
  admin: ['/dashboard', '/products', '/designs', '/content', '/orders', '/factories', '/cobuy', '/coupons', '/users', '/settings'],
  factory: ['/orders', '/users'],
};

const defaultRouteByRole: Record<AdminRole, string> = {
  admin: '/dashboard',
  factory: '/orders',
};

interface UseAdminAuthOptions {
  skip?: boolean;
}

interface UseAdminAuthResult {
  authStatus: AuthStatus;
  user: UserData | null;
  logout: () => void;
}

export function useAdminAuth(options: UseAdminAuthOptions = {}): UseAdminAuthResult {
  const { skip = false } = options;
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  const { user, authStatus, setUser, setAuthStatus, logout } = useAuthStore();

  // Handle Zustand hydration - wait for it to complete
  useEffect(() => {
    if (skip) {
      setIsHydrated(true);
      return;
    }

    // Check if already hydrated
    if (useAuthStore.persist.hasHydrated()) {
      setIsHydrated(true);
      setAuthStatus('checking');
      return;
    }

    // Subscribe to hydration completion
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
      setAuthStatus('checking');
    });

    // Trigger rehydration
    useAuthStore.persist.rehydrate();

    return () => {
      unsubscribe();
    };
  }, [skip, setAuthStatus]);

  // Check admin authentication after hydration
  useEffect(() => {
    if (skip || !isHydrated || authStatus !== 'checking') return;

    let isActive = true;

    const checkAdminAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (!supabaseUser) {
          if (isActive) setAuthStatus('unauthenticated');
          router.push('/login');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, email, phone_number, manufacturer_id, manufacturer:manufacturers(id, name)')
          .eq('id', supabaseUser.id)
          .single();

        if (error || !profile) {
          console.error('Error fetching profile:', error);
          logout();
          if (isActive) setAuthStatus('unauthenticated');
          router.push('/login');
          return;
        }

        if (profile.role !== 'admin' && profile.role !== 'factory') {
          console.error('User does not have admin or factory role:', profile.role);
          logout();
          if (isActive) setAuthStatus('unauthenticated');
          router.push('/login');
          return;
        }

        const manufacturerRecord = Array.isArray(profile.manufacturer)
          ? profile.manufacturer[0]
          : profile.manufacturer;

        if (isActive) {
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email || profile.email || '',
            name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
            avatar_url: supabaseUser.user_metadata?.avatar_url,
            phone: supabaseUser.phone || profile.phone_number,
            role: profile.role,
            manufacturer_id: profile.manufacturer_id ?? null,
            manufacturer_name: manufacturerRecord?.name ?? null,
          });
        }
      } catch (error) {
        console.error('Error checking admin auth:', error);
        logout();
        if (isActive) setAuthStatus('unauthenticated');
        router.push('/login');
      }
    };

    checkAdminAuth();

    return () => {
      isActive = false;
    };
  }, [skip, isHydrated, authStatus, router, setUser, setAuthStatus, logout]);

  // Handle role-based route access
  useEffect(() => {
    if (skip || authStatus !== 'authenticated' || !user?.role) return;

    const role = user.role as AdminRole;
    if (role !== 'admin' && role !== 'factory') return;

    const allowedRoutes = allowedRoutesByRole[role];
    const isAllowed = allowedRoutes.some(
      (route) => pathname === route || (pathname ?? '').startsWith(`${route}/`)
    );

    if (!isAllowed) {
      router.push(defaultRouteByRole[role]);
    }
  }, [skip, pathname, user?.role, authStatus, router]);

  return { authStatus, user, logout };
}
