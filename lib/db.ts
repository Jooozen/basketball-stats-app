import * as SQLite from 'expo-sqlite';
import type {
  Team, TeamInsert,
  Player, PlayerInsert,
  Game, GameInsert,
  StatEvent, StatEventInsert,
} from './types';

// ============================================================
// DB インスタンス
// ============================================================

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return _db;
}

// ============================================================
// 初期化 — テーブル作成
// ============================================================

export async function initDatabase(dbName: string = 'basketball_stats.db'): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(dbName);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_my_team INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id),
      number INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      my_team_id INTEGER NOT NULL REFERENCES teams(id),
      opponent_team_id INTEGER NOT NULL REFERENCES teams(id),
      title TEXT,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'live',
      current_quarter INTEGER NOT NULL DEFAULT 1,
      category TEXT DEFAULT 'high_school',
      quarter_minutes INTEGER DEFAULT 10,
      overtime_minutes INTEGER DEFAULT 5,
      timer_seconds REAL,
      timer_running INTEGER DEFAULT 0,
      timer_started_at INTEGER,
      on_court_player_ids TEXT,
      on_court_my_side_ids TEXT,
      on_court_opp_side_ids TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stat_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      player_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      game_time REAL,
      zone TEXT
    );
  `);

  _db = db;
  return db;
}

// ワークスペース切替時にDBを再初期化
export async function switchDatabase(workspaceId: string): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
  const dbName = workspaceId
    ? `basketball_stats_${workspaceId}.db`
    : 'basketball_stats.db';
  await initDatabase(dbName);
}

// ============================================================
// Teams CRUD
// ============================================================

export async function getAllTeams(): Promise<Team[]> {
  const db = getDb();
  return db.getAllAsync<Team>('SELECT * FROM teams ORDER BY created_at DESC');
}

export async function getMyTeams(): Promise<Team[]> {
  const db = getDb();
  return db.getAllAsync<Team>(
    'SELECT * FROM teams WHERE is_my_team = 1 ORDER BY created_at DESC'
  );
}

export async function getTeamById(id: number): Promise<Team | null> {
  const db = getDb();
  return db.getFirstAsync<Team>('SELECT * FROM teams WHERE id = ?', [id]);
}

export async function insertTeam(team: TeamInsert): Promise<number> {
  const db = getDb();
  const result = await db.runAsync(
    'INSERT INTO teams (name, is_my_team) VALUES (?, ?)',
    [team.name, team.is_my_team]
  );
  return result.lastInsertRowId;
}

export async function updateTeam(id: number, fields: Partial<TeamInsert>): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (fields.name !== undefined) { sets.push('name = ?'); values.push(fields.name); }
  if (fields.is_my_team !== undefined) { sets.push('is_my_team = ?'); values.push(fields.is_my_team); }
  if (sets.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE teams SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteTeam(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM players WHERE team_id = ?', [id]);
  await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
}

// ============================================================
// Players CRUD
// ============================================================

export async function getPlayersByTeamId(teamId: number): Promise<Player[]> {
  const db = getDb();
  return db.getAllAsync<Player>(
    'SELECT * FROM players WHERE team_id = ? ORDER BY number ASC',
    [teamId]
  );
}

export async function getPlayerById(id: number): Promise<Player | null> {
  const db = getDb();
  return db.getFirstAsync<Player>('SELECT * FROM players WHERE id = ?', [id]);
}

export async function insertPlayer(player: PlayerInsert): Promise<number> {
  const db = getDb();
  const result = await db.runAsync(
    'INSERT INTO players (team_id, number, name) VALUES (?, ?, ?)',
    [player.team_id, player.number, player.name]
  );
  return result.lastInsertRowId;
}

export async function insertPlayersForNewTeam(teamId: number): Promise<void> {
  const db = getDb();
  const defaultNumbers = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  for (const num of defaultNumbers) {
    await db.runAsync(
      'INSERT INTO players (team_id, number, name) VALUES (?, ?, ?)',
      [teamId, num, '']
    );
  }
}

export async function updatePlayer(
  id: number,
  fields: Partial<Omit<PlayerInsert, 'team_id'>>
): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (fields.number !== undefined) { sets.push('number = ?'); values.push(fields.number); }
  if (fields.name !== undefined) { sets.push('name = ?'); values.push(fields.name); }
  if (sets.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deletePlayer(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM players WHERE id = ?', [id]);
}

// ============================================================
// Games CRUD
// ============================================================

export async function getAllGames(): Promise<Game[]> {
  const db = getDb();
  return db.getAllAsync<Game>('SELECT * FROM games ORDER BY created_at DESC');
}

export async function getRecentGames(limit: number = 3): Promise<Game[]> {
  const db = getDb();
  return db.getAllAsync<Game>(
    'SELECT * FROM games ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}

export async function getGameById(id: number): Promise<Game | null> {
  const db = getDb();
  return db.getFirstAsync<Game>('SELECT * FROM games WHERE id = ?', [id]);
}

export async function insertGame(game: GameInsert): Promise<number> {
  const db = getDb();
  const result = await db.runAsync(
    `INSERT INTO games (
      my_team_id, opponent_team_id, title, date, status, current_quarter,
      category, quarter_minutes, overtime_minutes,
      timer_seconds, timer_running, timer_started_at,
      on_court_player_ids, on_court_my_side_ids, on_court_opp_side_ids
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      game.my_team_id,
      game.opponent_team_id,
      game.title,
      game.date,
      game.status,
      game.current_quarter,
      game.category,
      game.quarter_minutes,
      game.overtime_minutes,
      game.timer_seconds,
      game.timer_running,
      game.timer_started_at,
      game.on_court_player_ids,
      game.on_court_my_side_ids,
      game.on_court_opp_side_ids,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateGame(id: number, fields: Partial<Game>): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  const columnMap: Record<string, string> = {
    my_team_id: 'my_team_id',
    opponent_team_id: 'opponent_team_id',
    title: 'title',
    date: 'date',
    status: 'status',
    current_quarter: 'current_quarter',
    category: 'category',
    quarter_minutes: 'quarter_minutes',
    overtime_minutes: 'overtime_minutes',
    timer_seconds: 'timer_seconds',
    timer_running: 'timer_running',
    timer_started_at: 'timer_started_at',
    on_court_player_ids: 'on_court_player_ids',
    on_court_my_side_ids: 'on_court_my_side_ids',
    on_court_opp_side_ids: 'on_court_opp_side_ids',
  };

  for (const [key, col] of Object.entries(columnMap)) {
    const val = (fields as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val as string | number | null);
    }
  }

  if (sets.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE games SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteGame(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM stat_events WHERE game_id = ?', [id]);
  await db.runAsync('DELETE FROM games WHERE id = ?', [id]);
}

// ============================================================
// StatEvents CRUD
// ============================================================

export async function getEventsByGameId(gameId: number): Promise<StatEvent[]> {
  const db = getDb();
  return db.getAllAsync<StatEvent>(
    'SELECT * FROM stat_events WHERE game_id = ? ORDER BY timestamp ASC',
    [gameId]
  );
}

export async function getEventsByPlayerId(playerId: number): Promise<StatEvent[]> {
  const db = getDb();
  return db.getAllAsync<StatEvent>(
    'SELECT * FROM stat_events WHERE player_id = ? ORDER BY timestamp ASC',
    [playerId]
  );
}

export async function insertStatEvent(event: StatEventInsert): Promise<number> {
  const db = getDb();
  const result = await db.runAsync(
    `INSERT INTO stat_events (
      game_id, player_id, team_id, quarter, action, timestamp, game_time, zone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.game_id,
      event.player_id,
      event.team_id,
      event.quarter,
      event.action,
      event.timestamp,
      event.game_time,
      event.zone,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateStatEvent(
  id: number,
  fields: Partial<Pick<StatEvent, 'action' | 'zone'>>
): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (fields.action !== undefined) { sets.push('action = ?'); values.push(fields.action); }
  if (fields.zone !== undefined) { sets.push('zone = ?'); values.push(fields.zone); }
  if (sets.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE stat_events SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteStatEvent(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM stat_events WHERE id = ?', [id]);
}

// ============================================================
// ユーティリティ
// ============================================================

export async function getPlayerCountByTeamId(teamId: number): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM players WHERE team_id = ?',
    [teamId]
  );
  return row?.count ?? 0;
}

// 試合のスコアを取得（JOINなしで軽量に）
export async function getGameScore(gameId: number, myTeamId: number, opponentTeamId: number): Promise<{ myScore: number; oppScore: number }> {
  const db = getDb();
  let myScore = 0;
  let oppScore = 0;

  const rows = await db.getAllAsync<{ team_id: number; action: string }>(
    "SELECT team_id, action FROM stat_events WHERE game_id = ? AND action IN ('pts2', 'pts3', 'ft')",
    [gameId]
  );
  for (const r of rows) {
    const pts = r.action === 'pts3' ? 3 : r.action === 'pts2' ? 2 : 1;
    if (r.team_id === myTeamId) myScore += pts;
    else if (r.team_id === opponentTeamId) oppScore += pts;
  }
  return { myScore, oppScore };
}
