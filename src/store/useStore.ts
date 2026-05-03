import { create } from 'zustand';

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

export const useStore = create<AppState>((set) => ({
  currentPlayer: null,
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  logout: () => set({ currentPlayer: null }),
}));
