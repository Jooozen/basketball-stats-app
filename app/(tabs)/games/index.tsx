import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function GamesScreen() {
  const router = useRouter();

  // 仮のゲームID（Phase3で実データに置換）
  const demoGameId = 1;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.newGameButton}
        onPress={() => {
          // Phase3: 新規試合作成フォームを表示
        }}
      >
        <Text style={styles.newGameButtonText}>＋ 新規試合</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>試合一覧</Text>
        <Text style={styles.placeholder}>
          この画面はPhase3で実装します
        </Text>

        {/* 遷移確認用のデモボタン */}
        <View style={styles.demoSection}>
          <Text style={styles.demoLabel}>遷移テスト用</Text>
          <Pressable
            style={styles.demoButton}
            onPress={() => router.push(`/games/${demoGameId}`)}
          >
            <Text style={styles.demoButtonText}>
              スタッツ記録画面へ →
            </Text>
          </Pressable>
          <Pressable
            style={[styles.demoButton, styles.demoButtonAlt]}
            onPress={() => router.push(`/games/${demoGameId}/summary`)}
          >
            <Text style={styles.demoButtonText}>
              試合サマリーへ →
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
  },
  newGameButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  newGameButtonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 14,
    color: Colors.textDim,
    textAlign: 'center',
    paddingVertical: 20,
  },
  demoSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
    marginTop: 8,
  },
  demoLabel: {
    fontSize: 12,
    color: Colors.textDim,
    textAlign: 'center',
    marginBottom: 12,
  },
  demoButton: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  demoButtonAlt: {
    backgroundColor: Colors.info,
  },
  demoButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
