import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import { getAllTeams, getRecentGames, getTeamById, getGameScore } from '@/lib/db';
import type { Team, Game } from '@/lib/types';

interface GameCardData {
  game: Game;
  myTeam: Team | null;
  oppTeam: Team | null;
  myScore: number;
  oppScore: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const [hasTeams, setHasTeams] = useState<boolean | null>(null);
  const [recentGames, setRecentGames] = useState<GameCardData[]>([]);

  const loadData = useCallback(async () => {
    try {
      const teams = await getAllTeams();
      setHasTeams(teams.length > 0);

      const games = await getRecentGames(3);
      const cards: GameCardData[] = [];
      for (const game of games) {
        const myTeam = await getTeamById(game.my_team_id);
        const oppTeam = await getTeamById(game.opponent_team_id);
        const { myScore, oppScore } = await getGameScore(
          game.id, game.my_team_id, game.opponent_team_id
        );
        cards.push({ game, myTeam, oppTeam, myScore, oppScore });
      }
      setRecentGames(cards);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>バスケスタッツ</Text>
        <Pressable
          style={styles.accountLink}
          onPress={() => router.push('/account')}
        >
          <Text style={styles.accountLinkText}>⚙</Text>
        </Pressable>
      </View>

      {/* メインアクション */}
      {hasTeams === false ? (
        <Pressable
          style={styles.ctaButton}
          onPress={() => router.push('/(tabs)/teams')}
        >
          <Text style={styles.ctaButtonText}>チームを登録してください</Text>
          <Text style={styles.ctaSubText}>まずチームと選手を登録しましょう</Text>
        </Pressable>
      ) : hasTeams === true ? (
        <Pressable
          style={styles.ctaButton}
          onPress={() => router.push('/(tabs)/games')}
        >
          <Text style={styles.ctaButtonText}>＋ 新規試合を作成</Text>
        </Pressable>
      ) : null}

      {/* 最近の試合 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近の試合</Text>
        {recentGames.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              まだ試合がありません
            </Text>
          </View>
        ) : (
          recentGames.map((card) => (
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
      </View>
    </ScrollView>
  );
}

function GameCard({ data, onPress }: { data: GameCardData; onPress: () => void }) {
  const { game, myTeam, oppTeam, myScore, oppScore } = data;
  const isIntraSquad = game.my_team_id === game.opponent_team_id;
  const isLive = game.status === 'live';

  const myLabel = isIntraSquad ? `${myTeam?.name ?? '?'} A` : (myTeam?.name ?? '?');
  const oppLabel = isIntraSquad ? `${oppTeam?.name ?? '?'} B` : (oppTeam?.name ?? '?');

  return (
    <Pressable style={styles.gameCard} onPress={onPress}>
      {/* ステータスバッジ */}
      <View style={styles.gameCardHeader}>
        <Text style={styles.gameDate}>{game.date}</Text>
        <View style={[styles.badge, isLive ? styles.badgeLive : styles.badgeFinished]}>
          <Text style={[styles.badgeText, isLive && styles.badgeTextLive]}>
            {isLive ? 'LIVE' : '終了'}
          </Text>
        </View>
      </View>

      {/* タイトル */}
      {game.title ? (
        <Text style={styles.gameTitle} numberOfLines={1}>
          {game.title}
        </Text>
      ) : null}

      {/* スコア */}
      <View style={styles.scoreRow}>
        <Text style={styles.teamLabel} numberOfLines={1}>{myLabel}</Text>
        <Text style={styles.scoreText}>{myScore}</Text>
        <Text style={styles.scoreDash}>-</Text>
        <Text style={styles.scoreText}>{oppScore}</Text>
        <Text style={[styles.teamLabel, styles.teamLabelOpp]} numberOfLines={1}>
          {oppLabel}
        </Text>
      </View>

      {/* クォーター情報 */}
      {isLive && (
        <Text style={styles.quarterInfo}>Q{game.current_quarter}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  accountLink: {
    position: 'absolute',
    right: 24,
    top: 62,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLinkText: {
    fontSize: 24,
  },
  ctaButton: {
    backgroundColor: Colors.accent,
    marginHorizontal: 24,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 28,
  },
  ctaButtonText: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: 'bold',
  },
  ctaSubText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
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
  // Game card
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
    marginBottom: 6,
  },
  gameDate: {
    fontSize: 13,
    color: Colors.textDim,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeLive: {
    backgroundColor: '#dc2626',
  },
  badgeFinished: {
    backgroundColor: Colors.surfaceLight,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textMuted,
  },
  badgeTextLive: {
    color: Colors.white,
  },
  gameTitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
  },
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
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    minWidth: 40,
    textAlign: 'center',
  },
  scoreDash: {
    fontSize: 20,
    color: Colors.textMuted,
  },
  quarterInfo: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textDim,
    marginTop: 4,
  },
});
