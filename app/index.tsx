import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '@/constants/colors';
import { getAllTeams, getPlayersByTeamId, getAllGames, getEventsByGameId } from '@/lib/db';
import { calcTeamScore } from '@/lib/stats';
import type { Team, Player, Game, StatEvent } from '@/lib/types';

export default function HomeScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<number, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const t = await getAllTeams();
      setTeams(t);

      // 全選手数を集計
      let allPlayers: Player[] = [];
      for (const team of t) {
        const p = await getPlayersByTeamId(team.id);
        allPlayers = allPlayers.concat(p);
      }
      setPlayers(allPlayers);

      const g = await getAllGames();
      setGames(g);

      // 各試合のイベント数
      const counts: Record<number, number> = {};
      for (const game of g) {
        const events = await getEventsByGameId(game.id);
        counts[game.id] = events.length;
      }
      setEventCounts(counts);
    } catch {
      // DB error
    } finally {
      setLoaded(true);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>バスケスタッツ</Text>
      <Text style={styles.subtitle}>Phase 1: データ層確認</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>DB ステータス</Text>
        <Text style={styles.statusOk}>
          {loaded ? '✓ SQLite 初期化完了' : '読み込み中...'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>テーブル</Text>
        <View style={styles.row}>
          <StatBox label="teams" value={teams.length} />
          <StatBox label="players" value={players.length} />
          <StatBox label="games" value={games.length} />
          <StatBox label="events" value={Object.values(eventCounts).reduce((a, b) => a + b, 0)} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>lib モジュール</Text>
        <Text style={styles.checkItem}>✓ lib/types.ts — 型定義</Text>
        <Text style={styles.checkItem}>✓ lib/db.ts — CRUD 関数</Text>
        <Text style={styles.checkItem}>✓ lib/stats.ts — スタッツ計算</Text>
        <Text style={styles.checkItem}>✓ lib/store.ts — Zustand ストア</Text>
      </View>
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  statusOk: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  checkItem: {
    fontSize: 14,
    color: Colors.success,
    marginBottom: 6,
  },
});
