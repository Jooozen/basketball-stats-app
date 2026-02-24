import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function AccountScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function handleChangePassword() {
    if (!currentPassword) {
      Alert.alert('エラー', '現在のパスワードを入力してください');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      Alert.alert('エラー', '新しいパスワードは4文字以上で入力してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('エラー', '新しいパスワードが一致しません');
      return;
    }
    // Phase4: 実際のパスワード変更処理
    Alert.alert('確認', 'パスワード変更機能は今後実装されます');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function handleLogout() {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: () => {
            // Phase4: 実際のログアウト処理
            router.back();
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* アカウント情報 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>アカウント情報</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ワークスペース名</Text>
          <Text style={styles.infoValue}>デフォルト</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>パスコード</Text>
          <Text style={styles.infoValueMasked}>••••••••</Text>
        </View>
      </View>

      {/* パスコード変更 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>パスコードを変更</Text>
        <Text style={styles.label}>現在のパスコード</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="現在のパスコード"
          placeholderTextColor={Colors.textDim}
        />
        <Text style={styles.label}>新しいパスコード</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="4文字以上"
          placeholderTextColor={Colors.textDim}
        />
        <Text style={styles.label}>新しいパスコード（確認）</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="もう一度入力"
          placeholderTextColor={Colors.textDim}
          onSubmitEditing={handleChangePassword}
        />
        <Pressable style={styles.changeButton} onPress={handleChangePassword}>
          <Text style={styles.changeButtonText}>パスコードを変更</Text>
        </Pressable>
      </View>

      {/* ログアウト */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>ログアウト</Text>
      </Pressable>

      {/* バージョン情報 */}
      <View style={styles.versionSection}>
        <Text style={styles.versionText}>バスケスタッツ v1.0.0</Text>
        <Text style={styles.versionSub}>Expo React Native</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.textMuted,
    width: 140,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.white,
  },
  infoValueMasked: {
    fontSize: 17,
    color: Colors.textDim,
    letterSpacing: 3,
  },
  label: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 8,
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
  changeButton: {
    backgroundColor: Colors.info,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  changeButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: Colors.danger,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 15,
    color: Colors.textDim,
    fontWeight: '600',
  },
  versionSub: {
    fontSize: 13,
    color: Colors.textDim,
    marginTop: 4,
  },
});
