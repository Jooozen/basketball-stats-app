// ============================================================
// StatAction — スタッツアクション (15種)
// ============================================================
export type StatAction =
  | 'pts2'
  | 'pts3'
  | 'ft'
  | 'miss2'
  | 'miss3'
  | 'missFt'
  | 'reb'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'to'
  | 'foul'
  | 'subIn'
  | 'subOut'
  | 'timeout';

// ============================================================
// ShotZone — シュートゾーン (9エリア)
// ============================================================
export type ShotZone =
  | 'paint'
  | 'midLeft'
  | 'midCenter'
  | 'midRight'
  | 'threeLeftCorner'
  | 'threeLeftWing'
  | 'threeTop'
  | 'threeRightWing'
  | 'threeRightCorner';

export interface ShotZoneInfo {
  label: string;
  is3pt: boolean;
}

export const SHOT_ZONE_INFO: Record<ShotZone, ShotZoneInfo> = {
  paint: { label: 'ペイント', is3pt: false },
  midLeft: { label: 'ミドル左', is3pt: false },
  midCenter: { label: 'ミドル中央', is3pt: false },
  midRight: { label: 'ミドル右', is3pt: false },
  threeLeftCorner: { label: '左コーナー', is3pt: true },
  threeLeftWing: { label: '左ウイング', is3pt: true },
  threeTop: { label: 'トップ', is3pt: true },
  threeRightWing: { label: '右ウイング', is3pt: true },
  threeRightCorner: { label: '右コーナー', is3pt: true },
};

// ============================================================
// GameCategory — 試合カテゴリ (3種)
// ============================================================
export type GameCategory = 'junior_high' | 'high_school' | 'adult';

export interface GameCategoryConfig {
  label: string;
  quarterMinutes: number;
  overtimeMinutes: number;
  timeouts: { firstHalf: number; secondHalf: number; overtime: number };
}

export const GAME_CATEGORY_CONFIG: Record<GameCategory, GameCategoryConfig> = {
  junior_high: {
    label: '中学',
    quarterMinutes: 8,
    overtimeMinutes: 5,
    timeouts: { firstHalf: 2, secondHalf: 3, overtime: 1 },
  },
  high_school: {
    label: '高校',
    quarterMinutes: 10,
    overtimeMinutes: 5,
    timeouts: { firstHalf: 2, secondHalf: 3, overtime: 1 },
  },
  adult: {
    label: '社会人',
    quarterMinutes: 10,
    overtimeMinutes: 5,
    timeouts: { firstHalf: 2, secondHalf: 3, overtime: 1 },
  },
};

// ============================================================
// DB Row Types — テーブル行の型
// ============================================================

export interface Team {
  id: number;
  name: string;
  is_my_team: number; // 0 | 1 (SQLite boolean)
  created_at: string;
}

export interface Player {
  id: number;
  team_id: number;
  number: number;
  name: string;
}

export interface Game {
  id: number;
  my_team_id: number;
  opponent_team_id: number;
  title: string | null;
  date: string;
  status: 'live' | 'finished';
  current_quarter: number;
  category: GameCategory | null;
  quarter_minutes: number;
  overtime_minutes: number;
  timer_seconds: number | null;
  timer_running: number; // 0 | 1
  timer_started_at: number | null;
  on_court_player_ids: string | null;    // JSON array
  on_court_my_side_ids: string | null;   // JSON array (紅白戦用)
  on_court_opp_side_ids: string | null;  // JSON array (紅白戦用)
  created_at: string;
}

export interface StatEvent {
  id: number;
  game_id: number;
  player_id: number;
  team_id: number;
  quarter: number;
  action: StatAction;
  timestamp: string;
  game_time: number | null;
  zone: string | null;
}

// ============================================================
// PlayerStats — 選手スタッツ集計
// ============================================================

export interface PlayerStats {
  pts: number;
  fg: number;   // フィールドゴール成功
  fga: number;  // フィールドゴール試投
  tp: number;   // 3P成功
  tpa: number;  // 3P試投
  ft: number;   // FT成功
  fta: number;  // FT試投
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  foul: number;
}

// ============================================================
// Insert types (id を除いた型)
// ============================================================

export type TeamInsert = Omit<Team, 'id' | 'created_at'>;
export type PlayerInsert = Omit<Player, 'id'>;
export type GameInsert = Omit<Game, 'id' | 'created_at'>;
export type StatEventInsert = Omit<StatEvent, 'id'>;
