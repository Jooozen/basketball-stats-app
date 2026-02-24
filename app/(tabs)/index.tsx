import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>バスケスタッツ</Text>
      </View>

      <View style={styles.content}>
        <Pressable
          style={styles.newGameButton}
          onPress={() => router.push('/(tabs)/games')}
        >
          <Text style={styles.newGameButtonText}>＋ 新規試合</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>最近の試合</Text>
          <Text style={styles.placeholder}>
            この画面はPhase3で実装します
          </Text>
        </View>

        <Pressable
          style={styles.accountButton}
          onPress={() => router.push('/account')}
        >
          <Text style={styles.accountButtonText}>⚙ アカウント設定</Text>
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
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
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
    marginBottom: 24,
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
  accountButton: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  accountButtonText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});
