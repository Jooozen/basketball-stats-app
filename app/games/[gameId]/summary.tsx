import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function GameSummaryScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* スコア仮UI */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <Text style={styles.teamName}>自チーム</Text>
          <Text style={styles.score}>0 - 0</Text>
          <Text style={[styles.teamName, styles.oppTeam]}>相手</Text>
        </View>
        <Text style={styles.dateText}>2026/01/01 終了</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>試合サマリー</Text>
        <Text style={styles.gameIdText}>試合ID: {gameId}</Text>
        <Text style={styles.placeholder}>
          この画面はPhase3で実装します
        </Text>
        <Text style={styles.hint}>
          選手別スタッツ表、CSV出力機能を{'\n'}
          Phase3で実装します
        </Text>
      </View>

      <Pressable
        style={styles.recordButton}
        onPress={() => router.push(`/games/${gameId}`)}
      >
        <Text style={styles.recordButtonText}>記録画面に戻る</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
  },
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  oppTeam: {
    color: Colors.teamOpp,
  },
  score: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.white,
  },
  dateText: {
    fontSize: 13,
    color: Colors.textDim,
    marginTop: 8,
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
    marginBottom: 8,
  },
  gameIdText: {
    fontSize: 13,
    color: Colors.textDim,
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 14,
    color: Colors.textDim,
    textAlign: 'center',
    paddingVertical: 20,
  },
  hint: {
    fontSize: 13,
    color: Colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  recordButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  recordButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
