import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { AuthUser, getUser, saveUser } from '@/lib/auth';

// Extended profile with friends & extra fields
export interface Friend {
  id: string;
  username: string;
  avatarUrl?: string | null;
  eloBlitz: number;
  isOnline?: boolean;
}

export interface UserProfile extends AuthUser {
  eloBullet?: number;
  bio?: string;
  country?: string;
  totalGames?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  friends?: Friend[];
  joinedAt?: string;
}

interface ProfileState {
  // Panel visibility
  isOpen: boolean;
  activeTab: 'overview' | 'dashboard' | 'edit' | 'friends';

  // Profile data
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Edit form
  editForm: Partial<UserProfile>;

  // Actions
  openProfile: () => void;
  closeProfile: () => void;
  setActiveTab: (tab: ProfileState['activeTab']) => void;
  loadProfile: () => Promise<void>;
  updateEditForm: (fields: Partial<UserProfile>) => void;
  saveProfile: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  isOpen: false,
  activeTab: 'overview',
  profile: null,
  isLoading: false,
  isSaving: false,
  error: null,
  editForm: {},

  openProfile: () => {
    set({ isOpen: true });
    // Load profile data when opening
    get().loadProfile();
  },

  closeProfile: () => set({ isOpen: false, activeTab: 'overview', error: null }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      // Try to get from localStorage first (fast load)
      const localUser = getUser();
      if (localUser) {
        const mockProfile: UserProfile = {
          ...localUser,
          eloBullet: 1150,
          bio: 'Chess strategist. Always looking for the winning move.',
          country: 'Vietnam',
          totalGames: 248,
          wins: 142,
          losses: 78,
          draws: 28,
          joinedAt: localUser.createdAt,
          friends: [
            { id: '1', username: 'Magnus_Fan', eloBlitz: 1850, isOnline: true },
            { id: '2', username: 'KingSlayer99', eloBlitz: 1620, isOnline: false },
            { id: '3', username: 'ChessWizard', eloBlitz: 2100, isOnline: true },
            { id: '4', username: 'NightRider', eloBlitz: 1380, isOnline: false },
          ],
        };
        set({ profile: mockProfile, editForm: mockProfile, isLoading: false });
      }

      // Try to fetch from API
      try {
        const apiProfile = await apiFetch<UserProfile>('/user/me');
        const enriched: UserProfile = {
          ...apiProfile,
          eloBullet: (apiProfile as UserProfile).eloBullet ?? 1150,
          bio: (apiProfile as UserProfile).bio ?? 'Chess strategist.',
          country: (apiProfile as UserProfile).country ?? 'Vietnam',
          totalGames: (apiProfile as UserProfile).totalGames ?? 0,
          wins: (apiProfile as UserProfile).wins ?? 0,
          losses: (apiProfile as UserProfile).losses ?? 0,
          draws: (apiProfile as UserProfile).draws ?? 0,
          friends: (apiProfile as UserProfile).friends ?? [],
        };
        set({ profile: enriched, editForm: enriched, isLoading: false });
        saveUser(enriched);
      } catch {
        // Use local data, already set above
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: 'Failed to load profile', isLoading: false });
    }
  },

  updateEditForm: (fields) => {
    set((state) => ({ editForm: { ...state.editForm, ...fields } }));
  },

  saveProfile: async () => {
    const { editForm } = get();
    set({ isSaving: true, error: null });
    try {
      // Try API save
      try {
        await apiFetch('/user/me', {
          method: 'PATCH',
          body: JSON.stringify({
            username: editForm.username,
            bio: editForm.bio,
            country: editForm.country,
          }),
        });
      } catch {
        // Silently fallback to local save only
      }

      // Always update local state
      set((state) => ({
        profile: { ...state.profile!, ...state.editForm },
        isSaving: false,
        activeTab: 'overview',
      }));

      // Persist to localStorage
      const updated = { ...get().profile!, ...editForm };
      saveUser(updated);
    } catch (err) {
      set({ error: 'Failed to save profile', isSaving: false });
    }
  },

  uploadAvatar: async (file: File) => {
    set({ isSaving: true, error: null });
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      // Create local preview
      const localUrl = URL.createObjectURL(file);

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'}/user/avatar`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const newUrl = data.avatarUrl ?? localUrl;
          set((state) => ({
            profile: state.profile ? { ...state.profile, avatarUrl: newUrl } : null,
            editForm: { ...state.editForm, avatarUrl: newUrl },
            isSaving: false,
          }));
          return;
        }
      } catch {
        // Fallback to display local preview
      }

      // Local-only update
      set((state) => ({
        profile: state.profile ? { ...state.profile, avatarUrl: localUrl } : null,
        editForm: { ...state.editForm, avatarUrl: localUrl },
        isSaving: false,
      }));
    } catch (err) {
      set({ error: 'Failed to upload avatar', isSaving: false });
    }
  },
}));
