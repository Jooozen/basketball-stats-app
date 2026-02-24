import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import {
  getMyTeams, getAllTeams, getPlayersByTeamId, getPlayerCountByTeamId,
  getAllGames, getTeamById, getGameScore,
  insertTeam, insertPlayer, insertGame,
} from '@/lib/db';
import {
  GAME_CATEGORY_CONFIG,
  type Team, type Game, type GameCategory,
} from '@/lib/types';

// ============================================================
// 型
// ============================================================

interface GameCardData {
  game: Game;
  myTeam: Team | null;
  oppTeam: Team | null;
  myScore: number;
  oppScore: number;
}

interface TeamWithCount {
  team: Team;
  playerCount: number;
}

interface OpponentPlayer {
  number: string;
  name: string;
}

// ============================================================
// クォーター時間の選択肢
// ============================================================

const QUARTER_MINUTES_OPTIONS = [5, 6, 7, 8, 10, 12];

// ============================================================
// メイン画面
// ============================================================

export default function GamesScreen() {
  const router = useRouter();

  // データ
  const [games, setGames] = useState<GameCardData[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [allTeamsWithCount, setAllTeamsWithCount] = useState<TeamWithCount[]>([]);
  const [loaded, setLoaded] = useState(false);

  // フォーム表示
  const [showCreate, setShowCreate] = useState(false);

  // フォーム状態
  const [selectedMyTeamId, setSelectedMyTeamId] = useState<number | null>(null);
  const [gameTitle, setGameTitle] = useState('');
  const [gameDate, setGameDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [category, setCategory] = useState<GameCategory>('high_school');
  const [quarterMinutes, setQuarterMinutes] = useState(10);

  // 対戦相手
  const [opponentMode, setOpponentMode] = useState<'existing' | 'new'>('existing');
  const [selectedOppTeamId, setSelectedOppTeamId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState('');
  const [opponentPlayers, setOpponentPlayers] = useState<OpponentPlayer[]>(
    Array.from({ length: 5 }, () => ({ number: '', name: '' }))
  );
  const [creating, setCreating] = useState(false);

  // ロード
  const loadData = useCallback(async () => {
    try {
      // 試合一覧
      const allGames = await getAllGames();
      const cards: GameCardData[] = [];
      for (const game of allGames) {
        const myTeam = await getTeamById(game.my_team_id);
        const oppTeam = await getTeamById(game.opponent_team_id);
        const { myScore, oppScore } = await getGameScore(
          game.id, game.my_team_id, game.opponent_team_id
        );
        cards.push({ game, myTeam, oppTeam, myScore, oppScore });
      }
      setGames(cards);

      // 自チーム
      const my = await getMyTeams();
      setMyTeams(my);
      if (my.length > 0 && !selectedMyTeamId) {
        setSelectedMyTeamId(my[0].id);
      }

      // 全チーム（選手数付き）
      const all = await getAllTeams();
      const withCounts: TeamWithCount[] = [];
      for (const t of all) {
        const count = await getPlayerCountByTeamId(t.id);
        withCounts.push({ team: t, playerCount: count });
      }
      setAllTeamsWithCount(withCounts);
      if (withCounts.length > 0 && !selectedOppTeamId) {
        setSelectedOppTeamId(withCounts[0].team.id);
      }
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // 対戦相手の選手行更新
  function updateOppPlayer(index: number, field: 'number' | 'name', value: string) {
    setOpponentPlayers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addOppPlayerRow() {
    setOpponentPlayers(prev => [...prev, { number: '', name: '' }]);
  }

  // フォームリセット
  function resetForm() {
    setGameTitle('');
    setGameDate(new Date().toISOString().split('T')[0]);
    setCategory('high_school');
    setQuarterMinutes(10);
    setOpponentMode('existing');
    setOpponentName('');
    setOpponentPlayers(Array.from({ length: 5 }, () => ({ number: '', name: '' })));
  }

  // 試合作成
  async function createGame() {
    if (!selectedMyTeamId || creating) return;
    setCreating(true);

    try {
      let oppTeamId: number;

      if (opponentMode === 'existing') {
        if (!selectedOppTeamId) {
          Alert.alert('エラー', '対戦相手チームを選択してください');
          return;
        }
        oppTeamId = selectedOppTeamId;
      } else {
        if (!opponentName.trim()) {
          Alert.alert('エラー', '対戦相手チーム名を入力してください');
          return;
        }
        const validPlayers = opponentPlayers.filter(
          p => p.number.trim() && p.name.trim()
        );
        if (validPlayers.length < 5) {
          Alert.alert('エラー', '対戦相手の選手を最低5人登録してください（番号と名前両方必要）');
          return;
        }

        oppTeamId = await insertTeam({ name: opponentName.trim(), is_my_team: 0 });
        for (const p of validPlayers) {
          await insertPlayer({
            team_id: oppTeamId,
            number: parseInt(p.number),
            name: p.name.trim(),
          });
        }
      }

      const config = GAME_CATEGORY_CONFIG[category];
      const timerSeconds = quarterMinutes * 60;

      const gameId = await insertGame({
        my_team_id: selectedMyTeamId,
        opponent_team_id: oppTeamId,
        title: gameTitle.trim() || null,
        date: gameDate,
        status: 'live',
        current_quarter: 1,
        category,
        quarter_minutes: quarterMinutes,
        overtime_minutes: config.overtimeMinutes,
        timer_seconds: timerSeconds,
        timer_running: 0,
        timer_started_at: null,
        on_court_player_ids: null,
        on_court_my_side_ids: null,
        on_court_opp_side_ids: null,
      });

      resetForm();
      setShowCreate(false);
      router.push(`/games/${gameId}`);
    } catch (err) {
      Alert.alert('エラー', '試合の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  }

  const hasMyTeams = myTeams.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ヘッダーアクション */}
        {!hasMyTeams ? (
          <Pressable
            style={styles.noTeamCard}
            onPress={() => router.push('/(tabs)/teams')}
          >
            <Text style={styles.noTeamText}>
              試合を作成するにはまずチームを登録してください
            </Text>
            <Text style={styles.noTeamAction}>チーム登録 →</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.createToggle, showCreate && styles.createToggleActive]}
            onPress={() => setShowCreate(!showCreate)}
          >
            <Text style={styles.createToggleText}>
              {showCreate ? '✕ 閉じる' : '＋ 新しい試合を作成'}
            </Text>
          </Pressable>
        )}

        {/* 作成フォーム */}
        {showCreate && (
          <CreateGameForm
            myTeams={myTeams}
            allTeamsWithCount={allTeamsWithCount}
            selectedMyTeamId={selectedMyTeamId}
            setSelectedMyTeamId={setSelectedMyTeamId}
            gameTitle={gameTitle}
            setGameTitle={setGameTitle}
            gameDate={gameDate}
            setGameDate={setGameDate}
            category={category}
            setCategory={setCategory}
            quarterMinutes={quarterMinutes}
            setQuarterMinutes={setQuarterMinutes}
            opponentMode={opponentMode}
            setOpponentMode={setOpponentMode}
            selectedOppTeamId={selectedOppTeamId}
            setSelectedOppTeamId={setSelectedOppTeamId}
            opponentName={opponentName}
            setOpponentName={setOpponentName}
            opponentPlayers={opponentPlayers}
            updateOppPlayer={updateOppPlayer}
            addOppPlayerRow={addOppPlayerRow}
            creating={creating}
            onSubmit={createGame}
          />
        )}

        {/* 試合一覧 */}
        <Text style={styles.sectionTitle}>試合一覧</Text>
        {!loaded ? (
          <Text style={styles.loadingText}>読み込み中...</Text>
        ) : games.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>試合がまだありません</Text>
          </View>
        ) : (
          games.map(card => (
            <GameCard
              key={card.game.id}
              data={card}
              onPress={() => {
                if (card.game.status === 'finished') {
                  router.push(`/games/${card.game.id}/summary`);
                } else {
                  router.push(`/games/${card.game.id}`);
                }
              }}
            />
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// GameCard
// ============================================================

function GameCard({ data, onPress }: { data: GameCardData; onPress: () => void }) {
  const { game, myTeam, oppTeam, myScore, oppScore } = data;
  const isIntraSquad = game.my_team_id === game.opponent_team_id;
  const isLive = game.status === 'live';

  const myLabel = isIntraSquad ? `${myTeam?.name ?? '?'} A` : (myTeam?.name ?? '?');
  const oppLabel = isIntraSquad ? `${oppTeam?.name ?? '?'} B` : (oppTeam?.name ?? '?');

  return (
    <Pressable style={styles.gameCard} onPress={onPress}>
      <View style={styles.gameCardHeader}>
        <View style={styles.gameCardMeta}>
          {game.title ? (
            <Text style={styles.gameTitleText} numberOfLines={1}>{game.title}</Text>
          ) : null}
          <Text style={styles.gameDateText}>{game.date}</Text>
        </View>
        <View style={[styles.badge, isLive ? styles.badgeLive : styles.badgeFinished]}>
          <Text style={[styles.badgeText, isLive && styles.badgeTextLive]}>
            {isLive ? 'LIVE' : '終了'}
          </Text>
        </View>
      </View>
      <View style={styles.scoreRow}>
        <Text style={styles.teamLabel} numberOfLines={1}>{myLabel}</Text>
        <Text style={styles.scoreText}>{myScore}</Text>
        <Text style={styles.scoreDash}>-</Text>
        <Text style={styles.scoreText}>{oppScore}</Text>
        <Text style={[styles.teamLabel, styles.teamLabelOpp]} numberOfLines={1}>
          {oppLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================
// CreateGameForm
// ============================================================

function CreateGameForm({
  myTeams, allTeamsWithCount,
  selectedMyTeamId, setSelectedMyTeamId,
  gameTitle, setGameTitle,
  gameDate, setGameDate,
  category, setCategory,
  quarterMinutes, setQuarterMinutes,
  opponentMode, setOpponentMode,
  selectedOppTeamId, setSelectedOppTeamId,
  opponentName, setOpponentName,
  opponentPlayers, updateOppPlayer, addOppPlayerRow,
  creating, onSubmit,
}: {
  myTeams: Team[];
  allTeamsWithCount: TeamWithCount[];
  selectedMyTeamId: number | null;
  setSelectedMyTeamId: (id: number) => void;
  gameTitle: string;
  setGameTitle: (v: string) => void;
  gameDate: string;
  setGameDate: (v: string) => void;
  category: GameCategory;
  setCategory: (c: GameCategory) => void;
  quarterMinutes: number;
  setQuarterMinutes: (m: number) => void;
  opponentMode: 'existing' | 'new';
  setOpponentMode: (m: 'existing' | 'new') => void;
  selectedOppTeamId: number | null;
  setSelectedOppTeamId: (id: number) => void;
  opponentName: string;
  setOpponentName: (v: string) => void;
  opponentPlayers: OpponentPlayer[];
  updateOppPlayer: (i: number, field: 'number' | 'name', val: string) => void;
  addOppPlayerRow: () => void;
  creating: boolean;
  onSubmit: () => void;
}) {
  const categories = Object.entries(GAME_CATEGORY_CONFIG) as [GameCategory, typeof GAME_CATEGORY_CONFIG[GameCategory]][];

  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>新しい試合を作成</Text>

      {/* 自チーム選択 */}
      <Text style={styles.label}>自チーム</Text>
      <View style={styles.chipRow}>
        {myTeams.map(team => (
          <Pressable
            key={team.id}
            style={[styles.chip, selectedMyTeamId === team.id && styles.chipActive]}
            onPress={() => setSelectedMyTeamId(team.id)}
          >
            <Text style={[styles.chipText, selectedMyTeamId === team.id && styles.chipTextActive]}>
              {team.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 試合タイトル */}
      <Text style={styles.label}>試合タイトル（任意）</Text>
      <TextInput
        style={styles.input}
        value={gameTitle}
        onChangeText={setGameTitle}
        placeholder="例: 練習試合、インターハイ予選"
        placeholderTextColor={Colors.textDim}
      />

      {/* 試合日 */}
      <Text style={styles.label}>試合日</Text>
      <TextInput
        style={styles.input}
        value={gameDate}
        onChangeText={setGameDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={Colors.textDim}
      />

      {/* カテゴリ */}
      <Text style={styles.label}>カテゴリ</Text>
      <View style={styles.chipRow}>
        {categories.map(([key, config]) => (
          <Pressable
            key={key}
            style={[styles.categoryChip, category === key && styles.chipActive]}
            onPress={() => {
              setCategory(key);
              setQuarterMinutes(config.quarterMinutes);
            }}
          >
            <Text style={[styles.chipText, category === key && styles.chipTextActive]}>
              {config.label}
            </Text>
            <Text style={[styles.chipSub, category === key && styles.chipSubActive]}>
              Q{config.quarterMinutes}分
            </Text>
          </Pressable>
        ))}
      </View>

      {/* クォーター時間 */}
      <Text style={styles.label}>1クォーターの時間</Text>
      <View style={styles.chipRow}>
        {QUARTER_MINUTES_OPTIONS.map(min => (
          <Pressable
            key={min}
            style={[styles.timeChip, quarterMinutes === min && styles.chipActive]}
            onPress={() => setQuarterMinutes(min)}
          >
            <Text style={[styles.chipText, quarterMinutes === min && styles.chipTextActive]}>
              {min}分
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 対戦相手 */}
      <Text style={styles.label}>対戦相手</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.modeChip, opponentMode === 'existing' && styles.chipActive]}
          onPress={() => setOpponentMode('existing')}
        >
          <Text style={[styles.chipText, opponentMode === 'existing' && styles.chipTextActive]}>
            登録済み
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeChip, opponentMode === 'new' && styles.chipActive]}
          onPress={() => setOpponentMode('new')}
        >
          <Text style={[styles.chipText, opponentMode === 'new' && styles.chipTextActive]}>
            新規入力
          </Text>
        </Pressable>
      </View>

      {opponentMode === 'existing' ? (
        <View style={styles.oppSection}>
          {allTeamsWithCount.length === 0 ? (
            <Text style={styles.hintText}>
              登録済みのチームがありません。「新規入力」から作成してください。
            </Text>
          ) : (
            <View style={styles.chipRow}>
              {allTeamsWithCount.map(({ team, playerCount }) => (
                <Pressable
                  key={team.id}
                  style={[styles.chip, selectedOppTeamId === team.id && styles.chipActiveBlue]}
                  onPress={() => setSelectedOppTeamId(team.id)}
                >
                  <Text style={[styles.chipText, selectedOppTeamId === team.id && styles.chipTextActive]}>
                    {team.name}（{playerCount}人）{team.is_my_team ? ' ★' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.oppSection}>
          <TextInput
            style={styles.input}
            value={opponentName}
            onChangeText={setOpponentName}
            placeholder="相手チーム名を入力"
            placeholderTextColor={Colors.textDim}
          />
          <Text style={[styles.label, { marginTop: 12 }]}>
            選手（最低5人、番号と名前を入力）
          </Text>
          {opponentPlayers.map((p, i) => (
            <View key={i} style={styles.oppPlayerRow}>
              <TextInput
                style={[styles.input, styles.oppNumInput]}
                value={p.number}
                onChangeText={v => updateOppPlayer(i, 'number', v)}
                placeholder="#"
                placeholderTextColor={Colors.textDim}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, styles.oppNameInput]}
                value={p.name}
                onChangeText={v => updateOppPlayer(i, 'name', v)}
                placeholder="選手名"
                placeholderTextColor={Colors.textDim}
              />
            </View>
          ))}
          <Pressable style={styles.addRowButton} onPress={addOppPlayerRow}>
            <Text style={styles.addRowButtonText}>＋ 選手を追加</Text>
          </Pressable>
        </View>
      )}

      {/* 作成ボタン */}
      <Pressable
        style={[styles.submitButton, creating && styles.disabledButton]}
        onPress={onSubmit}
        disabled={creating}
      >
        <Text style={styles.submitButtonText}>
          {creating ? '作成中...' : '試合を開始する'}
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // ヘッダーアクション
  noTeamCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  noTeamText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  noTeamAction: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  createToggle: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  createToggleActive: {
    backgroundColor: Colors.surfaceLight,
  },
  createToggleText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },

  // 試合一覧
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textDim,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textDim,
  },

  // GameCard
  gameCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  gameCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameCardMeta: {
    flex: 1,
    marginRight: 8,
  },
  gameTitleText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  gameDateText: {
    fontSize: 13,
    color: Colors.textDim,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeLive: { backgroundColor: '#dc2626' },
  badgeFinished: { backgroundColor: Colors.surfaceLight },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textMuted,
  },
  badgeTextLive: { color: Colors.white },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  teamLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.accent,
    width: 90,
    textAlign: 'right',
  },
  teamLabelOpp: {
    color: Colors.teamOpp,
    textAlign: 'left',
  },
  scoreText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: Colors.white,
    minWidth: 36,
    textAlign: 'center',
  },
  scoreDash: {
    fontSize: 20,
    color: Colors.textMuted,
  },

  // フォーム
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    color: Colors.text,
    fontSize: 16,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 4,
  },

  // チップ系
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  chipActive: {
    backgroundColor: Colors.accent,
  },
  chipActiveBlue: {
    backgroundColor: Colors.teamOpp,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: Colors.white,
  },
  categoryChip: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  chipSub: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  chipSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  timeChip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeChip: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  // 対戦相手セクション
  oppSection: {
    marginBottom: 12,
  },
  oppPlayerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  oppNumInput: {
    width: 64,
    textAlign: 'center',
  },
  oppNameInput: {
    flex: 1,
  },
  addRowButton: {
    paddingVertical: 8,
    marginTop: 4,
  },
  addRowButtonText: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 14,
    color: Colors.textDim,
    paddingVertical: 8,
  },

  // 送信
  submitButton: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
