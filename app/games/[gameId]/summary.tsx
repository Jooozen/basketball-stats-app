import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/colors';
import {
  getGameById, getTeamById, getPlayersByTeamId,
  getEventsByGameId,
} from '@/lib/db';
import { calcPlayerStats, emptyStats, mergeStats } from '@/lib/stats';
import type {
  Game, Team, Player, StatEvent, PlayerStats,
} from '@/lib/types';

// ============================================================
// メイン
// ============================================================

export default function GameSummaryScreen() {
  const { gameId: gameIdStr } = useLocalSearchParams<{ gameId: string }>();
  const gameId = parseInt(gameIdStr, 10);
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [oppTeam, setOppTeam] = useState<Team | null>(null);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);
  const [oppPlayers, setOppPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<StatEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'my' | 'opp'>('my');

  const isIntraSquad = game ? game.my_team_id === game.opponent_team_id : false;
  const virtualOppTeamId = game
    ? (isIntraSquad ? -game.my_team_id : game.opponent_team_id)
    : 0;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const g = await getGameById(gameId);
        if (!g) return;
        setGame(g);

        const intra = g.my_team_id === g.opponent_team_id;
        const [mt, ot] = await Promise.all([
          getTeamById(g.my_team_id),
          getTeamById(g.opponent_team_id),
        ]);
        setMyTeam(mt);
        setOppTeam(ot);

        const myP = await getPlayersByTeamId(g.my_team_id);
        const oppP = intra ? [] : await getPlayersByTeamId(g.opponent_team_id);
        setMyPlayers(myP);
        setOppPlayers(oppP);

        setEvents(await getEventsByGameId(gameId));
        setLoaded(true);
      })();
    }, [gameId])
  );

  // ============================================================
  // 計算
  // ============================================================

  const myTeamLabel = isIntraSquad ? `${myTeam?.name ?? '?'} A` : (myTeam?.name ?? '?');
  const oppTeamLabel = isIntraSquad ? `${myTeam?.name ?? '?'} B` : (oppTeam?.name ?? '?');

  const myTeamStats = useMemo(() =>
    calcPlayerStats(events.filter(e => e.team_id === game?.my_team_id)),
    [events, game?.my_team_id]);

  const oppTeamStats = useMemo(() =>
    calcPlayerStats(events.filter(e => e.team_id === virtualOppTeamId)),
    [events, virtualOppTeamId]);

  function buildPlayerStatsRows(players: Player[], teamId: number) {
    const rows: { player: Player; stats: PlayerStats }[] = [];
    let total = emptyStats();
    for (const p of players) {
      const pEvents = events.filter(e => {
        if (e.player_id !== p.id) return false;
        if (isIntraSquad) return e.team_id === teamId;
        return true;
      });
      const st = calcPlayerStats(pEvents);
      rows.push({ player: p, stats: st });
      total = mergeStats(total, st);
    }
    return { rows, total };
  }

  const myPlayerStats = useMemo(
    () => buildPlayerStatsRows(myPlayers, game?.my_team_id ?? 0),
    [events, myPlayers, game?.my_team_id, isIntraSquad]
  );

  const oppPlayerStats = useMemo(
    () => buildPlayerStatsRows(
      isIntraSquad ? myPlayers : oppPlayers,
      virtualOppTeamId,
    ),
    [events, myPlayers, oppPlayers, virtualOppTeamId, isIntraSquad]
  );

  const currentStats = tab === 'my' ? myPlayerStats : oppPlayerStats;

  // ============================================================
  // CSV出力
  // ============================================================

  async function exportCSV() {
    if (!game) return;

    const header = ['チーム', '背番号', '名前', 'PTS', 'FG', 'FGA', '3P', '3PA', 'FT', 'FTA', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FOUL'];
    const rows: string[][] = [];

    function addTeamRows(label: string, data: { rows: { player: Player; stats: PlayerStats }[]; total: PlayerStats }) {
      for (const { player, stats } of data.rows) {
        rows.push([
          label, String(player.number),
          player.name || `選手${player.number}`,
          String(stats.pts), String(stats.fg), String(stats.fga),
          String(stats.tp), String(stats.tpa),
          String(stats.ft), String(stats.fta),
          String(stats.reb), String(stats.ast), String(stats.stl),
          String(stats.blk), String(stats.to), String(stats.foul),
        ]);
      }
      const t = data.total;
      rows.push([
        label, '', '合計',
        String(t.pts), String(t.fg), String(t.fga),
        String(t.tp), String(t.tpa),
        String(t.ft), String(t.fta),
        String(t.reb), String(t.ast), String(t.stl),
        String(t.blk), String(t.to), String(t.foul),
      ]);
    }

    addTeamRows(myTeamLabel, myPlayerStats);
    rows.push([]);
    addTeamRows(oppTeamLabel, oppPlayerStats);

    const bom = '\uFEFF';
    const csv = bom + [header.join(','), ...rows.map(r => r.join(','))].join('\n');

    const fileName = `game_${gameId}_stats_${game.date}.csv`;
    const file = new File(Paths.cache, fileName);
    file.write(csv);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'スタッツCSVを共有',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('エラー', '共有機能が利用できません');
    }
  }

  // ============================================================
  // ヘルパー
  // ============================================================

  const STAT_LABELS = ['PTS', 'FG', '3P', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FOUL'];

  function statValue(stats: PlayerStats, label: string): string {
    switch (label) {
      case 'PTS': return String(stats.pts);
      case 'FG': return `${stats.fg}/${stats.fga}`;
      case '3P': return `${stats.tp}/${stats.tpa}`;
      case 'FT': return `${stats.ft}/${stats.fta}`;
      case 'REB': return String(stats.reb);
      case 'AST': return String(stats.ast);
      case 'STL': return String(stats.stl);
      case 'BLK': return String(stats.blk);
      case 'TO': return String(stats.to);
      case 'FOUL': return String(stats.foul);
      default: return '';
    }
  }

  function pct(made: number, att: number): string {
    if (att === 0) return '-';
    return `${Math.round((made / att) * 100)}%`;
  }

  // ============================================================
  // レンダー
  // ============================================================

  if (!loaded || !game) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ═══ スコア ═══ */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreTeam}>
            <Text style={styles.teamNameMy} numberOfLines={1}>{myTeamLabel}</Text>
            <Text style={styles.scoreNumMy}>{myTeamStats.pts}</Text>
          </View>
          <Text style={styles.scoreDash}>-</Text>
          <View style={styles.scoreTeam}>
            <Text style={styles.teamNameOpp} numberOfLines={1}>{oppTeamLabel}</Text>
            <Text style={styles.scoreNumOpp}>{oppTeamStats.pts}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>
          {game.date} {game.status === 'finished' ? '終了' : 'LIVE'}
        </Text>
        {game.title ? <Text style={styles.titleText}>{game.title}</Text> : null}
      </View>

      {/* ═══ チーム比較 ═══ */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>チーム比較</Text>
        <View style={styles.compHeader}>
          <Text style={[styles.compTeamName, { color: Colors.teamMy }]}>{myTeamLabel}</Text>
          <Text style={styles.compStatLabel} />
          <Text style={[styles.compTeamName, { color: Colors.teamOpp }]}>{oppTeamLabel}</Text>
        </View>
        {STAT_LABELS.map(label => (
          <View key={label} style={styles.compRow}>
            <Text style={styles.compValue}>{statValue(myTeamStats, label)}</Text>
            <Text style={styles.compStatLabel}>{label}</Text>
            <Text style={styles.compValue}>{statValue(oppTeamStats, label)}</Text>
          </View>
        ))}
        <View style={styles.compRow}>
          <Text style={styles.compValue}>{pct(myTeamStats.fg, myTeamStats.fga)}</Text>
          <Text style={styles.compStatLabel}>FG%</Text>
          <Text style={styles.compValue}>{pct(oppTeamStats.fg, oppTeamStats.fga)}</Text>
        </View>
        <View style={styles.compRow}>
          <Text style={styles.compValue}>{pct(myTeamStats.tp, myTeamStats.tpa)}</Text>
          <Text style={styles.compStatLabel}>3P%</Text>
          <Text style={styles.compValue}>{pct(oppTeamStats.tp, oppTeamStats.tpa)}</Text>
        </View>
        <View style={styles.compRow}>
          <Text style={styles.compValue}>{pct(myTeamStats.ft, myTeamStats.fta)}</Text>
          <Text style={styles.compStatLabel}>FT%</Text>
          <Text style={styles.compValue}>{pct(oppTeamStats.ft, oppTeamStats.fta)}</Text>
        </View>
      </View>

      {/* ═══ 個人スタッツ ═══ */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>個人スタッツ</Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, tab === 'my' && styles.tabActiveMy]}
            onPress={() => setTab('my')}
          >
            <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>{myTeamLabel}</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'opp' && styles.tabActiveOpp]}
            onPress={() => setTab('opp')}
          >
            <Text style={[styles.tabText, tab === 'opp' && styles.tabTextActive]}>{oppTeamLabel}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tCell, styles.tNumCell, styles.tHeaderText]}>#</Text>
              <Text style={[styles.tCell, styles.tNameCell, styles.tHeaderText]}>名前</Text>
              {STAT_LABELS.map(c => (
                <Text key={c} style={[styles.tCell, styles.tHeaderText]}>{c}</Text>
              ))}
            </View>

            {currentStats.rows.map(({ player, stats }) => (
              <View key={player.id} style={styles.tableRow}>
                <Text style={[styles.tCell, styles.tNumCell, styles.tBold]}>{player.number}</Text>
                <Text style={[styles.tCell, styles.tNameCell]} numberOfLines={1}>
                  {player.name || `選手${player.number}`}
                </Text>
                {STAT_LABELS.map(c => (
                  <Text key={c} style={styles.tCell}>{statValue(stats, c)}</Text>
                ))}
              </View>
            ))}

            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tCell, styles.tNumCell, styles.tTotalText]}>合計</Text>
              <Text style={[styles.tCell, styles.tNameCell]} />
              {STAT_LABELS.map(c => (
                <Text key={c} style={[styles.tCell, styles.tTotalText]}>
                  {statValue(currentStats.total, c)}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ═══ アクション ═══ */}
      <View style={styles.actionSection}>
        <Pressable style={styles.csvBtn} onPress={exportCSV}>
          <Text style={styles.csvBtnText}>CSV出力</Text>
        </Pressable>

        {game.status === 'live' && (
          <Pressable
            style={styles.recordBtn}
            onPress={() => router.push(`/games/${gameId}`)}
          >
            <Text style={styles.recordBtnText}>記録画面に戻る</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  loadingText: {
    color: Colors.textMuted, fontSize: 18,
    textAlign: 'center', marginTop: 60,
  },

  // ─── スコアカード ───
  scoreCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 24, alignItems: 'center', marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  scoreTeam: { flex: 1, alignItems: 'center' },
  teamNameMy: { fontSize: 16, fontWeight: 'bold', color: Colors.teamMy, marginBottom: 4 },
  teamNameOpp: { fontSize: 16, fontWeight: 'bold', color: Colors.teamOpp, marginBottom: 4 },
  scoreNumMy: { fontSize: 48, fontWeight: 'bold', color: Colors.teamMy },
  scoreNumOpp: { fontSize: 48, fontWeight: 'bold', color: Colors.teamOpp },
  scoreDash: { fontSize: 28, color: Colors.textMuted },
  dateText: { fontSize: 13, color: Colors.textDim, marginTop: 8 },
  titleText: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },

  // ─── カード ───
  card: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 16, marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 12,
  },

  // ─── チーム比較 ───
  compHeader: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  compRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  compValue: {
    flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center',
  },
  compTeamName: { flex: 1, fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  compStatLabel: {
    width: 60, fontSize: 12, fontWeight: 'bold', color: Colors.textMuted, textAlign: 'center',
  },

  // ─── タブ ───
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surfaceLight, alignItems: 'center',
  },
  tabActiveMy: { backgroundColor: Colors.teamMy },
  tabActiveOpp: { backgroundColor: Colors.teamOpp },
  tabText: { fontSize: 14, fontWeight: 'bold', color: Colors.textMuted },
  tabTextActive: { color: Colors.white },

  // ─── テーブル ───
  tableHeader: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  totalRow: { backgroundColor: Colors.surfaceLight },
  tCell: { width: 48, fontSize: 12, color: Colors.text, textAlign: 'center' },
  tNumCell: { width: 36, textAlign: 'left' },
  tNameCell: { width: 72, textAlign: 'left', fontSize: 12, color: Colors.text },
  tHeaderText: { fontWeight: 'bold', color: Colors.textMuted, fontSize: 11 },
  tBold: { fontWeight: 'bold', color: Colors.white },
  tTotalText: { fontWeight: 'bold', color: Colors.accent },

  // ─── アクション ───
  actionSection: { gap: 10, marginTop: 8 },
  csvBtn: {
    backgroundColor: Colors.success, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  csvBtnText: { fontSize: 18, fontWeight: 'bold', color: Colors.white },
  recordBtn: {
    backgroundColor: Colors.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  recordBtnText: { fontSize: 18, fontWeight: 'bold', color: Colors.white },
});
