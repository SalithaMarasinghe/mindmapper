import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { ApiResult, UserProfile } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<ApiResult<null>>;
  signIn: (email: string, password: string) => Promise<ApiResult<null>>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: { displayName: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true, // Start loading initially while checking session

  signUp: async (email, password, displayName) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) return { data: null, error: error.message };
      
      // Auto sign-in after successful sign-up
      return await get().signIn(email, password);
    } catch (e) {
      if (e instanceof Error) return { data: null, error: e.message };
      return { data: null, error: 'Unknown error occurred' };
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { data: null, error: error.message };

      if (data.user) {
        set({ user: data.user });
        await get().fetchProfile();
        toast.success('Welcome back! 👋');
      }

      return { data: null, error: null };
    } catch (e) {
      if (e instanceof Error) return { data: null, error: e.message };
      return { data: null, error: 'Unknown error occurred' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
    toast.success('Signed out successfully');
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Failed to fetch profile:', error);
        return;
      }

      if (data) {
        // Map database row to UserProfile
        set({
          profile: {
            id: data.id,
            displayName: data.display_name,
            avatarUrl: data.avatar_url,
            createdAt: data.created_at,
          },
        });
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  },

  updateProfile: async (updates) => {
    const { user, profile } = get();
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: updates.displayName })
        .eq('id', user.id);
      
      if (error) throw error;
      
      if (profile) {
        set({ profile: { ...profile, displayName: updates.displayName } });
      }
    } catch (e) {
      console.error('Failed to update profile:', e);
      throw e;
    }
  },
}));

// Initialize the store connection to supabase auth
const initAuth = async () => {
  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Auth session check timed out')), 4000);
      }),
    ]);
    const { data: { session } } = sessionResult;
    const currentUser = session?.user || null;
    
    if (currentUser?.id !== useAuthStore.getState().user?.id) {
      useAuthStore.setState({ user: currentUser });
      if (currentUser) {
        void useAuthStore.getState().fetchProfile();
      } else {
        useAuthStore.setState({ profile: null });
      }
    }
  } catch (e) {
    console.error('Initial session check failed:', e);
  } finally {
    useAuthStore.setState({ isLoading: false });
  }
};

initAuth();

supabase.auth.onAuthStateChange((_event, session) => {
  const currentUser = session?.user || null;
  
  try {
    if (currentUser?.id !== useAuthStore.getState().user?.id) {
      useAuthStore.setState({ user: currentUser });
      if (currentUser) {
        void useAuthStore.getState().fetchProfile();
      } else {
        useAuthStore.setState({ profile: null });
      }
    }
  } catch (e) {
    console.error('Auth state change handling failed:', e);
  } finally {
    useAuthStore.setState({ isLoading: false });
  }
});
