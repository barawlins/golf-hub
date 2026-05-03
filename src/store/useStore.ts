import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Player = {
  id: string;
  name: string;
  pin: string;
  role: 'commissioner' | 'player';
  team_id: string | null;
  photo_url?: string;
  teams?: { name: string };
};

interface AppState {
  currentPlayer: Player | null;
  setCurrentPlayer: (player: Player | null) => void;
  logout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentPlayer: null,
      setCurrentPlayer: (player) => set({ currentPlayer: player }),
      logout: () => set({ currentPlayer: null }),
    }),
    {
      name: 'golf-hub-storage',
    }
  )
);
