import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function AccountScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>アカウント情報</Text>
        <View style={styles.row}>
          <Text style={styles.label}>アカウント名</Text>
          <Text style={styles.value}>デフォルト</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>パスワード</Text>
          <Text style={styles.valueMasked}>********</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>パスワードを変更</Text>
        <Text style={styles.placeholder}>
          この画面はPhase3で実装します
        </Text>
      </View>

      <Pressable
        style={styles.logoutButton}
        onPress={() => {
          // Phase3: ログアウト処理
          router.back();
        }}
      >
        <Text style={styles.logoutButtonText}>ログアウト</Text>
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
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: Colors.textMuted,
    width: 120,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  valueMasked: {
    fontSize: 14,
    color: Colors.textDim,
    letterSpacing: 4,
  },
  placeholder: {
    fontSize: 14,
    color: Colors.textDim,
    textAlign: 'center',
    paddingVertical: 20,
  },
  logoutButton: {
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
