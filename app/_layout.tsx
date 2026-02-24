import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '@/lib/db';
import { Colors } from '@/constants/colors';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DB初期化エラー</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>読み込み中...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="games/[gameId]/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="games/[gameId]/summary"
          options={{
            title: '試合サマリー',
            headerBackTitle: '戻る',
          }}
        />
        <Stack.Screen
          name="account"
          options={{
            title: 'アカウント設定',
            headerBackTitle: '戻る',
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 18,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDetail: {
    color: Colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
