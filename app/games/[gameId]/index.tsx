import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function GameStatsScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* スコアボード仮UI */}
      <View style={styles.scoreboard}>
        <View style={styles.scoreRow}>
          <Text style={styles.teamName}>自チーム</Text>
          <Text style={styles.score}>0</Text>
          <Text style={styles.dash}>-</Text>
          <Text style={styles.score}>0</Text>
          <Text style={[styles.teamName, styles.oppTeam]}>相手</Text>
        </View>
        <Text style={styles.quarterLabel}>Q1 10:00</Text>
      </View>

      {/* メインエリア */}
      <View style={styles.main}>
        <Text style={styles.gameIdText}>試合ID: {gameId}</Text>
        <Text style={styles.placeholder}>
          スタッツ記録画面{'\n'}
          この画面はPhase3で実装します
        </Text>
        <Text style={styles.hint}>
          タブバーが非表示になっていることを確認してください
        </Text>
      </View>

      {/* 下部ボタン */}
      <View style={styles.footer}>
        <Pressable
          style={styles.summaryButton}
          onPress={() => router.push(`/games/${gameId}/summary`)}
        >
          <Text style={styles.summaryButtonText}>サマリーを表示</Text>
        </Pressable>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scoreboard: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.accent,
    width: 80,
    textAlign: 'right',
  },
  oppTeam: {
    color: Colors.teamOpp,
    textAlign: 'left',
  },
  score: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.white,
  },
  dash: {
    fontSize: 24,
    color: Colors.textMuted,
    marginHorizontal: 4,
  },
  quarterLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 6,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  gameIdText: {
    fontSize: 14,
    color: Colors.textDim,
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 18,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    color: Colors.success,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    gap: 8,
  },
  summaryButton: {
    backgroundColor: Colors.info,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  summaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});
