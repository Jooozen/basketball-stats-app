import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import {
  getAllTeams, insertTeam, updateTeam, deleteTeam,
  getPlayersByTeamId, insertPlayer, insertPlayersForNewTeam,
  updatePlayer, deletePlayer,
} from '@/lib/db';
import type { Team, Player } from '@/lib/types';

// ============================================================
// メイン画面
// ============================================================

export default function TeamsScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const loadTeams = useCallback(async () => {
    const t = await getAllTeams();
    setTeams(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTeams();
    }, [loadTeams])
  );

  async function handleAddTeam() {
    const name = newTeamName.trim();
    if (!name) return;
    const id = await insertTeam({ name, is_my_team: 1 });
    await insertPlayersForNewTeam(id);
    setNewTeamName('');
    setShowAddTeam(false);
    await loadTeams();
    setExpandedTeamId(id);
  }

  async function handleDeleteTeam(team: Team) {
    Alert.alert(
      'チームを削除',
      `「${team.name}」を削除しますか？\n所属する選手もすべて削除されます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteTeam(team.id);
            if (expandedTeamId === team.id) setExpandedTeamId(null);
            await loadTeams();
          },
        },
      ]
    );
  }

  async function handleToggleMyTeam(team: Team) {
    await updateTeam(team.id, { is_my_team: team.is_my_team ? 0 : 1 });
    await loadTeams();
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* チーム追加ボタン / フォーム */}
        {showAddTeam ? (
          <View style={styles.addForm}>
            <Text style={styles.addFormTitle}>新しいチームを追加</Text>
            <TextInput
              style={styles.input}
              value={newTeamName}
              onChangeText={setNewTeamName}
              placeholder="チーム名を入力"
              placeholderTextColor={Colors.textDim}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddTeam}
            />
            <Text style={styles.addFormHint}>
              作成時に背番号4〜18の選手枠を自動生成します
            </Text>
            <View style={styles.addFormButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => { setShowAddTeam(false); setNewTeamName(''); }}
              >
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmButton, !newTeamName.trim() && styles.disabledButton]}
                onPress={handleAddTeam}
                disabled={!newTeamName.trim()}
              >
                <Text style={styles.confirmButtonText}>＋ 追加</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.addTeamButton}
            onPress={() => setShowAddTeam(true)}
          >
            <Text style={styles.addTeamButtonText}>＋ チームを追加</Text>
          </Pressable>
        )}

        {/* チーム一覧 */}
        {teams.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              チームが登録されていません
            </Text>
          </View>
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isExpanded={expandedTeamId === team.id}
              onToggleExpand={() =>
                setExpandedTeamId(expandedTeamId === team.id ? null : team.id)
              }
              onDelete={() => handleDeleteTeam(team)}
              onToggleMyTeam={() => handleToggleMyTeam(team)}
              onPlayersChanged={loadTeams}
            />
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// TeamCard（展開/折りたたみ可能）
// ============================================================

function TeamCard({
  team,
  isExpanded,
  onToggleExpand,
  onDelete,
  onToggleMyTeam,
  onPlayersChanged,
}: {
  team: Team;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onToggleMyTeam: () => void;
  onPlayersChanged: () => void;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [addNumber, setAddNumber] = useState('');
  const [addName, setAddName] = useState('');

  useEffect(() => {
    if (isExpanded) {
      loadPlayers();
    }
  }, [isExpanded, team.id]);

  async function loadPlayers() {
    const p = await getPlayersByTeamId(team.id);
    setPlayers(p);
  }

  async function handleAddPlayer() {
    const num = parseInt(addNumber);
    if (isNaN(num)) {
      Alert.alert('エラー', '背番号を入力してください');
      return;
    }
    if (players.some(p => p.number === num)) {
      Alert.alert('エラー', `#${num} は既に登録されています`);
      return;
    }
    const name = addName.trim();
    await insertPlayer({ team_id: team.id, number: num, name });
    setAddNumber('');
    setAddName('');
    await loadPlayers();
  }

  async function handleDeletePlayer(player: Player) {
    Alert.alert(
      '選手を削除',
      `#${player.number} ${player.name || '(名前なし)'} を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deletePlayer(player.id);
            await loadPlayers();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.teamCard}>
      {/* ヘッダー（タップで展開） */}
      <Pressable style={styles.teamHeader} onPress={onToggleExpand}>
        <View style={styles.teamHeaderLeft}>
          <Text style={styles.teamName}>{team.name}</Text>
          {team.is_my_team ? (
            <View style={styles.myTeamBadge}>
              <Text style={styles.myTeamBadgeText}>自チーム</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
      </Pressable>

      {/* 展開時の内容 */}
      {isExpanded && (
        <View style={styles.teamBody}>
          {/* コントロール行 */}
          <View style={styles.controlRow}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>自チーム</Text>
              <Switch
                value={team.is_my_team === 1}
                onValueChange={onToggleMyTeam}
                trackColor={{ false: Colors.surfaceLight, true: Colors.accent }}
                thumbColor={Colors.white}
              />
            </View>
            <Pressable
              style={[styles.modeButton, editMode && styles.modeButtonActive]}
              onPress={() => setEditMode(!editMode)}
            >
              <Text style={[styles.modeButtonText, editMode && styles.modeButtonTextActive]}>
                {editMode ? '完了' : '選手管理'}
              </Text>
            </Pressable>
            <Pressable style={styles.deleteTeamButton} onPress={onDelete}>
              <Text style={styles.deleteTeamButtonText}>削除</Text>
            </Pressable>
          </View>

          {/* 選手一覧 */}
          <View style={styles.playerList}>
            <View style={styles.playerListHeader}>
              <Text style={[styles.playerColHeader, styles.colNumber]}>#</Text>
              <Text style={[styles.playerColHeader, styles.colName]}>名前</Text>
              {editMode && (
                <Text style={[styles.playerColHeader, styles.colAction]}>操作</Text>
              )}
            </View>
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                editMode={editMode}
                onUpdate={loadPlayers}
                onDelete={() => handleDeletePlayer(player)}
              />
            ))}
          </View>

          {/* 選手追加フォーム（編集モード時） */}
          {editMode && (
            <View style={styles.addPlayerForm}>
              <TextInput
                style={[styles.playerInput, styles.numberInput]}
                value={addNumber}
                onChangeText={setAddNumber}
                placeholder="#"
                placeholderTextColor={Colors.textDim}
                keyboardType="number-pad"
                returnKeyType="next"
              />
              <TextInput
                style={[styles.playerInput, styles.nameInput]}
                value={addName}
                onChangeText={setAddName}
                placeholder="名前（省略可）"
                placeholderTextColor={Colors.textDim}
                returnKeyType="done"
                onSubmitEditing={handleAddPlayer}
              />
              <Pressable style={styles.addPlayerButton} onPress={handleAddPlayer}>
                <Text style={styles.addPlayerButtonText}>追加</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.playerCount}>
            {players.length}人の選手
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// PlayerRow（インライン編集対応）
// ============================================================

function PlayerRow({
  player,
  editMode,
  onUpdate,
  onDelete,
}: {
  player: Player;
  editMode: boolean;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);
  const [tempName, setTempName] = useState(player.name);
  const [tempNumber, setTempNumber] = useState(String(player.number));

  async function saveName() {
    const name = tempName.trim();
    if (name !== player.name) {
      await updatePlayer(player.id, { name });
      onUpdate();
    }
    setEditingName(false);
  }

  async function saveNumber() {
    const num = parseInt(tempNumber);
    if (!isNaN(num) && num !== player.number) {
      await updatePlayer(player.id, { number: num });
      onUpdate();
    }
    setEditingNumber(false);
  }

  return (
    <View style={styles.playerRow}>
      {/* 背番号 */}
      {editMode && editingNumber ? (
        <TextInput
          style={[styles.playerInput, styles.colNumber, styles.editInput]}
          value={tempNumber}
          onChangeText={setTempNumber}
          keyboardType="number-pad"
          autoFocus
          onBlur={saveNumber}
          onSubmitEditing={saveNumber}
          selectTextOnFocus
        />
      ) : (
        <Pressable
          style={styles.colNumber}
          onPress={() => {
            if (editMode) {
              setTempNumber(String(player.number));
              setEditingNumber(true);
            }
          }}
        >
          <Text style={styles.playerNumber}>#{player.number}</Text>
        </Pressable>
      )}

      {/* 名前 */}
      {editMode && editingName ? (
        <TextInput
          style={[styles.playerInput, styles.colName, styles.editInput]}
          value={tempName}
          onChangeText={setTempName}
          autoFocus
          onBlur={saveName}
          onSubmitEditing={saveName}
          selectTextOnFocus
          placeholder="名前を入力"
          placeholderTextColor={Colors.textDim}
        />
      ) : (
        <Pressable
          style={styles.colName}
          onPress={() => {
            if (editMode) {
              setTempName(player.name);
              setEditingName(true);
            }
          }}
        >
          <Text style={[styles.playerName, !player.name && styles.playerNameEmpty]}>
            {player.name || (editMode ? 'タップして入力' : '—')}
          </Text>
        </Pressable>
      )}

      {/* 削除ボタン */}
      {editMode && (
        <Pressable style={styles.colAction} onPress={onDelete}>
          <Text style={styles.deletePlayerText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // チーム追加
  addTeamButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  addTeamButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  addForm: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  addFormTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  addFormHint: {
    fontSize: 13,
    color: Colors.textDim,
    marginBottom: 16,
  },
  addFormButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    color: Colors.text,
    fontSize: 16,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.4,
  },

  // 空状態
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

  // チームカード
  teamCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  teamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  myTeamBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  myTeamBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.white,
  },
  expandIcon: {
    fontSize: 14,
    color: Colors.textDim,
  },

  // チーム内容
  teamBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 16,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  switchLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  modeButton: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: Colors.info,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modeButtonTextActive: {
    color: Colors.white,
  },
  deleteTeamButton: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteTeamButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },

  // 選手一覧
  playerList: {
    marginBottom: 12,
  },
  playerListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  playerColHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textDim,
  },
  colNumber: {
    width: 56,
  },
  colName: {
    flex: 1,
  },
  colAction: {
    width: 48,
    alignItems: 'center',
  },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    minHeight: 48,
  },
  playerNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.accent,
    fontVariant: ['tabular-nums'],
  },
  playerName: {
    fontSize: 16,
    color: Colors.text,
  },
  playerNameEmpty: {
    color: Colors.textDim,
    fontStyle: 'italic',
  },

  // インライン編集
  editInput: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  playerInput: {
    backgroundColor: Colors.surfaceLight,
    color: Colors.text,
    fontSize: 15,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  numberInput: {
    width: 60,
    textAlign: 'center',
    marginRight: 8,
  },
  nameInput: {
    flex: 1,
    marginRight: 8,
  },

  deletePlayerText: {
    fontSize: 18,
    color: Colors.danger,
    fontWeight: 'bold',
  },

  // 選手追加
  addPlayerForm: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  addPlayerButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addPlayerButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },

  playerCount: {
    fontSize: 13,
    color: Colors.textDim,
    textAlign: 'center',
  },
});
