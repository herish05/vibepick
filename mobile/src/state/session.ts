import { create } from 'zustand';
import type { PendingContent } from '@/lib/sharing';

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  onboarded: boolean;
  pending: PendingContent | null;
  recommendationId: string | null;
  setSignedIn: (onboarded: boolean) => void;
  setSignedOut: () => void;
  setOnboarded: () => void;
  setPending: (p: PendingContent | null) => void;
  setRecommendationId: (id: string | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  onboarded: false,
  pending: null,
  recommendationId: null,
  setSignedIn: (onboarded) => set({ status: 'signedIn', onboarded }),
  setSignedOut: () => set({ status: 'signedOut', onboarded: false, pending: null, recommendationId: null }),
  setOnboarded: () => set({ onboarded: true }),
  setPending: (pending) => set({ pending }),
  setRecommendationId: (recommendationId) => set({ recommendationId }),
}));
