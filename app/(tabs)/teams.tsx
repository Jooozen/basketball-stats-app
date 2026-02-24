import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export default function TeamsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>チーム一覧</Text>
        <Text style={styles.placeholder}>
          この画面はPhase3で実装します
        </Text>
        <Text style={styles.hint}>
          チームの作成、選手の追加・編集・削除、{'\n'}
          エリア別シュート率の確認ができます
        </Text>
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
  hint: {
    fontSize: 13,
    color: Colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});
