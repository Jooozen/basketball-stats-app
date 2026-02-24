import { create } from 'zustand';
import { insertStatEvent, deleteStatEvent } from './db';
import type { StatAction, StatEvent, StatEventInsert } from './types';

interface GameState {
  // 選択中の選手
  selectedPlayerId: number | null;
  selectedTeamId: number | null;

  // 直前のイベント（取り消し用）
  lastEvent: (StatEvent & { id: number }) | null;

  // アクション
  selectPlayer: (playerId: number, teamId: number) => void;
  clearSelection: () => void;
  recordStat: (
    gameId: number,
    quarter: number,
    action: StatAction,
    gameTime?: number,
    zone?: string,
  ) => Promise<void>;
  undoLast: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  selectedPlayerId: null,
  selectedTeamId: null,
  lastEvent: null,

  selectPlayer: (playerId: number, teamId: number) => {
    set({ selectedPlayerId: playerId, selectedTeamId: teamId });
  },

  clearSelection: () => {
    set({ selectedPlayerId: null, selectedTeamId: null });
  },

  recordStat: async (
    gameId: number,
    quarter: number,
    action: StatAction,
    gameTime?: number,
    zone?: string,
  ) => {
    const { selectedPlayerId, selectedTeamId } = get();
    if (!selectedPlayerId || !selectedTeamId) return;

    const event: StatEventInsert = {
      game_id: gameId,
      player_id: selectedPlayerId,
      team_id: selectedTeamId,
      quarter,
      action,
      timestamp: new Date().toISOString(),
      game_time: gameTime ?? null,
      zone: zone ?? null,
    };

    const id = await insertStatEvent(event);
    set({
      lastEvent: { ...event, id } as StatEvent & { id: number },
    });
  },

  undoLast: async () => {
    const { lastEvent } = get();
    if (!lastEvent?.id) return;

    await deleteStatEvent(lastEvent.id);
    set({ lastEvent: null });
  },
}));
