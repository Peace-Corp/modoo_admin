import { createClient } from '@/lib/supabase-client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserData {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  phone?: string;
  role?: 'admin' | 'customer' | 'factory';
  created_at?: string;
}

interface AuthState {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Set user data and mark as authenticated
  setUser: (user: UserData) => void;

  // Clear user data and mark as not authenticated
  logout: () => void;

  // Update user profile
  updateUser: (updates: Partial<UserData>) => void;

  // Set loading state
  setLoading: (loading: boolean) => void;

  // Login with email and password
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;

  // Sign up with email and password
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }>;

  // Sign in with OAuth provider
  signInWithOAuth: (provider: 'google') => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          const supabase = createClient();

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.user) {
            // Set user data in store
            const userData: UserData = {
              id: data.user.id,
              email: data.user.email!,
              name: data.user.user_metadata?.name,
              avatar_url: data.user.user_metadata?.avatar_url,
              phone: data.user.phone,
              created_at: data.user.created_at,
            };

            set({
              user: userData,
              isAuthenticated: true,
              isLoading: false,
            });

            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Login failed' };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },

      signUp: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          const supabase = createClient();

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
            },
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.user) {
            // Check if email confirmation is needed
            const needsEmailConfirmation = !data.session;

            if (data.session) {
              // User is auto-confirmed, set user data
              const userData: UserData = {
                id: data.user.id,
                email: data.user.email!,
                name: data.user.user_metadata?.name,
                avatar_url: data.user.user_metadata?.avatar_url,
                phone: data.user.phone,
                created_at: data.user.created_at,
              };

              set({
                user: userData,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }

            return { success: true, needsEmailConfirmation };
          }

          set({ isLoading: false });
          return { success: false, error: 'Sign up failed' };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },

      signInWithOAuth: async (provider: 'google') => {
        try {
          set({ isLoading: true });
          const supabase = createClient();

          const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
              redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
            },
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          // OAuth will redirect, so loading state stays true
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
