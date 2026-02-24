# バスケスタッツ — React Native (Expo) 移植プロジェクト

## プロジェクト概要

既存の Next.js Web アプリ（stats2）を **Expo React Native** へ移植するプロジェクト。
バスケットボールの試合中にスタッツをリアルタイム記録し、選手別・エリア別の分析を行うアプリ。
主な利用環境は **iPad（体育館のベンチ）** を想定。オフライン完結で動作する。

元リポジトリ: `https://github.com/Jooozen/stats2.git`

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | **Expo SDK 54** + **expo-router** (ファイルベースルーティング) |
| 言語 | **TypeScript** |
| UI | **React Native StyleSheet** (ダークテーマ) |
| DB | **expo-sqlite** (SQLite) |
| 状態管理 | **Zustand** |
| ナビゲーション | **expo-router** (タブ + スタック) |

## Web アプリとの対応関係

| Web (stats2) | Native (本プロジェクト) | 備考 |
|--------------|----------------------|------|
| Next.js App Router | **expo-router** | ファイルベースルーティング |
| Dexie.js (IndexedDB) | **expo-sqlite** | SQL ベースに変換。マイグレーション管理が必要 |
| Tailwind CSS | **StyleSheet.create** | ダークテーマの色定数を共通化 |
| SVG コート図 | **react-native-svg** | 9 ゾーンのシュートチャートを再現 |
| Zustand | **Zustand** | そのまま流用可能 |
| localStorage (ワークスペース) | **expo-secure-store** or **AsyncStorage** | パスコードハッシュの保存 |
| CSV ダウンロード | **expo-file-system** + **expo-sharing** | ファイル生成→共有シートで出力 |

## データモデル

4 テーブル構成（Web 版と同一設計）:

### teams
```sql
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_my_team INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### players
```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  number INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT ''
);
```

### games
```sql
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  my_team_id INTEGER NOT NULL REFERENCES teams(id),
  opponent_team_id INTEGER NOT NULL REFERENCES teams(id),
  title TEXT,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live',        -- 'live' | 'finished'
  current_quarter INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'high_school',        -- 'junior_high' | 'high_school' | 'adult'
  quarter_minutes INTEGER DEFAULT 10,
  overtime_minutes INTEGER DEFAULT 5,
  timer_seconds REAL,
  timer_running INTEGER DEFAULT 0,
  timer_started_at INTEGER,
  on_court_player_ids TEXT,                   -- JSON array
  on_court_my_side_ids TEXT,                  -- JSON array (紅白戦用)
  on_court_opp_side_ids TEXT,                 -- JSON array (紅白戦用)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### stat_events
```sql
CREATE TABLE stat_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  action TEXT NOT NULL,                       -- StatAction 型
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  game_time REAL,
  zone TEXT                                   -- ShotZone 型
);
```

### StatAction (15 種)
`pts2`, `pts3`, `ft`, `miss2`, `miss3`, `missFt`, `reb`, `ast`, `stl`, `blk`, `to`, `foul`, `subIn`, `subOut`, `timeout`

### ShotZone (9 エリア)
`paint`, `midLeft`, `midCenter`, `midRight`, `threeLeftCorner`, `threeLeftWing`, `threeTop`, `threeRightWing`, `threeRightCorner`

### GameCategory (3 種)
| カテゴリ | ラベル | Q 時間 | OT 時間 |
|----------|--------|--------|---------|
| `junior_high` | 中学 | 8 分 | 5 分 |
| `high_school` | 高校 | 10 分 | 5 分 |
| `adult` | 社会人 | 10 分 | 5 分 |

## 画面構成とルート

```
app/
├── _layout.tsx                  # ルートレイアウト (AuthProvider)
├── login.tsx                    # ログイン/新規作成画面
├── (tabs)/
│   ├── _layout.tsx              # タブナビゲーション (ホーム/チーム/試合)
│   ├── index.tsx                # ホーム画面 (最近の試合, 新規試合ボタン)
│   ├── teams.tsx                # チーム・選手管理画面
│   └── games/
│       ├── _layout.tsx          # 試合スタック
│       ├── index.tsx            # 試合一覧 + 新規作成フォーム
│       ├── [gameId].tsx         # 試合スタッツ記録画面 (全画面, タブ非表示)
│       └── [gameId]/
│           └── summary.tsx      # 試合サマリー画面
└── account.tsx                  # アカウント設定画面
```

### Web 画面との対応

| Web パス | Native ルート | 画面内容 |
|----------|--------------|---------|
| `/` (AuthProvider 内) | `login.tsx` | ログイン / ワークスペース作成 |
| `/` | `(tabs)/index.tsx` | ホーム (最近の試合) |
| `/teams` | `(tabs)/teams.tsx` | チーム・選手管理 |
| `/games` | `(tabs)/games/index.tsx` | 試合一覧・新規作成 |
| `/games/[gameId]` | `(tabs)/games/[gameId].tsx` | 試合中スタッツ記録 |
| `/games/[gameId]/summary` | `(tabs)/games/[gameId]/summary.tsx` | 試合サマリー・CSV出力 |
| `/account` | `account.tsx` | アカウント設定 |

## 開発フェーズ

### Phase 1: データ層
- expo-sqlite セットアップとマイグレーション
- DB ヘルパー関数 (`lib/db.ts`)
- ワークスペース管理 (`lib/workspace.ts`) — AsyncStorage / SecureStore
- スタッツ計算ロジック (`lib/stats.ts`) — Web 版からほぼそのまま移植
- Zustand ストア (`lib/store.ts`)

### Phase 2: ナビゲーション・認証
- expo-router セットアップ (タブ + スタック)
- AuthProvider — ワークスペース認証
- ダークテーマのカラー定数・共通スタイル定義
- タブバー (ホーム / チーム / 試合 / アカウント)

### Phase 3: 各画面実装
- ホーム画面
- チーム・選手管理画面 (選手の CRUD、エリア別シュート率モーダル)
- 試合一覧・作成画面 (カテゴリ選択、対戦相手設定)
- **試合スタッツ記録画面**（最重要・最大画面）
  - スコアボード (スコア, Q 切替, カウントダウンタイマー, ポゼッション)
  - 選手リスト (コート上 5 人、左右分割)
  - SVG コート図 (react-native-svg, 9 ゾーン, 成功/失敗オーバーレイ)
  - スタッツボタン (2 行 x 6 列 = 12 個)
  - メンバーチェンジパネル (コート ↔ ベンチ交代)
  - スターティング 5 選択パネル
  - タイムラインパネル (修正・削除対応)
  - 紅白戦対応 (同一チーム A/B 側分離)
- 試合サマリー画面 (スタッツ表, CSV 出力)
- アカウント設定画面

### Phase 4: テスト・ビルド
- 主要フローの動作確認
- iPad 実機テスト
- EAS Build 設定

## iPad 最適化方針

- **ダークテーマ**: 背景 `#111827` (gray-900)、テキスト `#e5e7eb` (gray-200)、アクセント `#f97316` (orange-500)
- **大きいタップターゲット**: 最低 44x44pt、スタッツボタンはさらに大きく
- **体育館環境**: 高コントラスト、太字フォント、屋外光でも見やすい配色
- **横画面対応**: 試合記録画面はランドスケープも考慮
- **フォントサイズ**: Web 版より一回り大きく。選手番号・スコアは特に大きく表示

## カラーパレット

```typescript
export const Colors = {
  background: '#111827',    // gray-900
  surface: '#1f2937',       // gray-800
  surfaceLight: '#374151',  // gray-700
  text: '#e5e7eb',          // gray-200
  textMuted: '#9ca3af',     // gray-400
  textDim: '#6b7280',       // gray-500
  accent: '#f97316',        // orange-500
  accentHover: '#ea580c',   // orange-600
  success: '#16a34a',       // green-600
  danger: '#dc2626',        // red-600
  info: '#0284c7',          // sky-600
  teamMy: '#f97316',        // orange-500 (自チーム)
  teamOpp: '#3b82f6',       // blue-500 (相手チーム)
  court: '#1a472a',         // コート背景色
};
```

## UI テキスト

すべて **日本語** で実装する。Web 版のラベルをそのまま踏襲:

- ナビゲーション: ホーム / チーム / 試合
- スタッツボタン: 2P / 3P / FT / REB / AST / STL / ミス2P / ミス3P / ミスFT / BLK / TO / FOUL
- アクション: 戻す / メンバーチェンジ / 試合終了 / 中断 / スタッツ / タイムライン
- 試合ステータス: LIVE / 終了

## コマンド

```bash
# 開発サーバー起動
npx expo start

# iOS シミュレーター
npx expo start --ios

# ビルド
eas build --platform ios
```

## ディレクトリ構成（目標）

```
basketball-stats-app/
├── app/                    # expo-router ページ
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── account.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── teams.tsx
│       └── games/
├── lib/                    # ビジネスロジック
│   ├── db.ts               # expo-sqlite ラッパー、マイグレーション
│   ├── stats.ts            # スタッツ計算
│   ├── store.ts            # Zustand ストア
│   └── workspace.ts        # ワークスペース管理
├── components/             # 再利用可能コンポーネント
│   ├── CourtSvg.tsx        # SVG コート図
│   ├── PlayerRow.tsx       # 選手行
│   ├── StatsTable.tsx      # スタッツ表
│   └── TimerDisplay.tsx    # タイマー表示
├── constants/              # 定数
│   ├── colors.ts
│   ├── zones.ts            # シュートゾーン定義
│   └── categories.ts       # カテゴリ設定
├── assets/
├── app.json
├── package.json
├── tsconfig.json
└── CLAUDE.md               # このファイル
```
