import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Modal, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import {
  getGameById, getTeamById, getPlayersByTeamId,
  getEventsByGameId, insertStatEvent, deleteStatEvent,
  updateGame,
} from '@/lib/db';
import { useGameStore } from '@/lib/store';
import { calcPlayerStats, emptyStats, mergeStats } from '@/lib/stats';
import CourtSvg from '@/components/CourtSvg';
import {
  GAME_CATEGORY_CONFIG, SHOT_ZONE_INFO,
  type Game, type Team, type Player, type StatEvent, type PlayerStats,
  type StatAction, type GameCategory, type GameCategoryConfig, type ShotZone,
} from '@/lib/types';

// ============================================================
// 定数
// ============================================================

const STAT_ROW1: { action: StatAction; label: string; cat: 'shoot' | 'other' }[] = [
  { action: 'pts2', label: '2P', cat: 'shoot' },
  { action: 'pts3', label: '3P', cat: 'shoot' },
  { action: 'ft', label: 'FT', cat: 'shoot' },
  { action: 'reb', label: 'REB', cat: 'other' },
  { action: 'ast', label: 'AST', cat: 'other' },
  { action: 'stl', label: 'STL', cat: 'other' },
];

const STAT_ROW2: { action: StatAction; label: string; cat: 'shoot' | 'other' }[] = [
  { action: 'miss2', label: 'ミス2P', cat: 'shoot' },
  { action: 'miss3', label: 'ミス3P', cat: 'shoot' },
  { action: 'missFt', label: 'ミスFT', cat: 'shoot' },
  { action: 'blk', label: 'BLK', cat: 'other' },
  { action: 'to', label: 'TO', cat: 'other' },
  { action: 'foul', label: 'FOUL', cat: 'other' },
];

const ALL_STAT_BUTTONS = [...STAT_ROW1, ...STAT_ROW2];

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getQuarterLabel(q: number): string {
  if (q <= 4) return `Q${q}`;
  if (q === 5) return 'OT';
  return `OT${q - 4}`;
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function GameStatsScreen() {
  const { gameId: gameIdStr } = useLocalSearchParams<{ gameId: string }>();
  const gameId = parseInt(gameIdStr, 10);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // --- Zustand ---
  const { selectedPlayerId, selectedTeamId, selectPlayer, clearSelection } = useGameStore();

  // --- State ---
  const [game, setGame] = useState<Game | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [oppTeam, setOppTeam] = useState<Team | null>(null);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);
  const [oppPlayers, setOppPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<StatEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  // コート上の選手
  const [onCourtIds, setOnCourtIds] = useState<Set<number>>(new Set());
  const [onCourtMySideIds, setOnCourtMySideIds] = useState<Set<number>>(new Set());
  const [onCourtOppSideIds, setOnCourtOppSideIds] = useState<Set<number>>(new Set());

  // パネル表示
  const [showStartingLineup, setShowStartingLineup] = useState(false);
  const [showMemberChange, setShowMemberChange] = useState(false);
  const [showTimerInput, setShowTimerInput] = useState(false);
  const [showCourtShot, setShowCourtShot] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  // ポゼッション
  const [possession, setPossession] = useState<'my' | 'opp'>('my');

  // クォーター
  const [quarter, setQuarter] = useState(1);

  // タイマー
  const [timerDisplay, setTimerDisplay] = useState(600);
  const [timerRunning, setTimerRunning] = useState(false);
  const remainingRef = useRef(600);
  const startTimeRef = useRef(0);

  // フィードバック
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // タイマー入力
  const [timerInputMin, setTimerInputMin] = useState('');
  const [timerInputSec, setTimerInputSec] = useState('');

  // --- 派生値 ---
  const isIntraSquad = game ? game.my_team_id === game.opponent_team_id : false;
  const virtualOppTeamId = game
    ? (isIntraSquad ? -game.my_team_id : game.opponent_team_id)
    : 0;
  const categoryConfig: GameCategoryConfig | null = game?.category
    ? GAME_CATEGORY_CONFIG[game.category as GameCategory] ?? null
    : null;

  // ============================================================
  // データロード
  // ============================================================

  const loadData = useCallback(async () => {
    try {
      const g = await getGameById(gameId);
      if (!g) return;
      setGame(g);
      setQuarter(g.current_quarter);

      const intra = g.my_team_id === g.opponent_team_id;

      const [mt, ot] = await Promise.all([
        getTeamById(g.my_team_id),
        getTeamById(g.opponent_team_id),
      ]);
      setMyTeam(mt);
      setOppTeam(ot);

      const myP = await getPlayersByTeamId(g.my_team_id);
      const oppP = intra ? [] : await getPlayersByTeamId(g.opponent_team_id);
      setMyPlayers(myP);
      setOppPlayers(oppP);

      const evts = await getEventsByGameId(gameId);
      setEvents(evts);

      // On-court IDs
      if (g.on_court_player_ids) {
        try { setOnCourtIds(new Set(JSON.parse(g.on_court_player_ids))); } catch {}
      }
      if (g.on_court_my_side_ids) {
        try { setOnCourtMySideIds(new Set(JSON.parse(g.on_court_my_side_ids))); } catch {}
      }
      if (g.on_court_opp_side_ids) {
        try { setOnCourtOppSideIds(new Set(JSON.parse(g.on_court_opp_side_ids))); } catch {}
      }

      // スターティング未選択チェック
      let hasOnCourt = false;
      if (g.on_court_player_ids) {
        try { hasOnCourt = JSON.parse(g.on_court_player_ids).length > 0; } catch {}
      }
      if (!hasOnCourt) setShowStartingLineup(true);

      // タイマー復帰
      if (g.timer_seconds != null) {
        if (g.timer_running && g.timer_started_at) {
          const elapsed = (Date.now() - g.timer_started_at) / 1000;
          const rem = Math.max(0, g.timer_seconds - elapsed);
          remainingRef.current = rem;
          setTimerDisplay(rem);
          if (rem > 0) {
            startTimeRef.current = Date.now();
            setTimerRunning(true);
          } else {
            await updateGame(gameId, { timer_seconds: 0, timer_running: 0, timer_started_at: null });
          }
        } else {
          remainingRef.current = g.timer_seconds;
          setTimerDisplay(g.timer_seconds);
        }
      }

      setLoaded(true);
    } catch (err) {
      console.error('Failed to load game:', err);
    }
  }, [gameId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => { clearSelection(); };
    }, [loadData])
  );

  const reloadEvents = useCallback(async () => {
    setEvents(await getEventsByGameId(gameId));
  }, [gameId]);

  // ============================================================
  // タイマー
  // ============================================================

  useEffect(() => {
    if (!timerRunning) return;
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const rem = Math.max(0, remainingRef.current - elapsed);
      setTimerDisplay(rem);
      if (rem <= 0) {
        remainingRef.current = 0;
        setTimerRunning(false);
        updateGame(gameId, { timer_seconds: 0, timer_running: 0, timer_started_at: null });
      }
    }, 200);
    return () => clearInterval(iv);
  }, [timerRunning, gameId]);

  // ============================================================
  // 計算値 (useMemo / useCallback)
  // ============================================================

  const myScore = useMemo(() =>
    events.filter(e => e.team_id === game?.my_team_id)
      .reduce((s, e) => s + (e.action === 'pts3' ? 3 : e.action === 'pts2' ? 2 : e.action === 'ft' ? 1 : 0), 0),
    [events, game?.my_team_id]);

  const oppScore = useMemo(() =>
    events.filter(e => e.team_id === virtualOppTeamId)
      .reduce((s, e) => s + (e.action === 'pts3' ? 3 : e.action === 'pts2' ? 2 : e.action === 'ft' ? 1 : 0), 0),
    [events, virtualOppTeamId]);

  const myTeamQFouls = useMemo(() =>
    events.filter(e => e.team_id === game?.my_team_id && e.action === 'foul' && e.quarter === quarter).length,
    [events, game?.my_team_id, quarter]);

  const oppTeamQFouls = useMemo(() =>
    events.filter(e => e.team_id === virtualOppTeamId && e.action === 'foul' && e.quarter === quarter).length,
    [events, virtualOppTeamId, quarter]);

  const getPlayerFouls = useCallback((pid: number) =>
    events.filter(e => e.player_id === pid && e.action === 'foul').length,
    [events]);

  const getPlayerPoints = useCallback((pid: number) =>
    events.filter(e => e.player_id === pid)
      .reduce((s, e) => s + (e.action === 'pts3' ? 3 : e.action === 'pts2' ? 2 : e.action === 'ft' ? 1 : 0), 0),
    [events]);

  // コート上 / ベンチ
  const myCourt = useMemo(() =>
    isIntraSquad
      ? myPlayers.filter(p => onCourtMySideIds.has(p.id))
      : myPlayers.filter(p => onCourtIds.has(p.id)),
    [myPlayers, onCourtIds, onCourtMySideIds, isIntraSquad]);

  const oppCourt = useMemo(() =>
    isIntraSquad
      ? myPlayers.filter(p => onCourtOppSideIds.has(p.id))
      : oppPlayers.filter(p => onCourtIds.has(p.id)),
    [myPlayers, oppPlayers, onCourtIds, onCourtOppSideIds, isIntraSquad]);

  const myBench = useMemo(() =>
    isIntraSquad
      ? myPlayers.filter(p => !onCourtMySideIds.has(p.id) && !onCourtOppSideIds.has(p.id))
      : myPlayers.filter(p => !onCourtIds.has(p.id)),
    [myPlayers, onCourtIds, onCourtMySideIds, onCourtOppSideIds, isIntraSquad]);

  const oppBench = useMemo(() =>
    isIntraSquad ? myBench : oppPlayers.filter(p => !onCourtIds.has(p.id)),
    [oppPlayers, onCourtIds, myBench, isIntraSquad]);

  const myTeamLabel = isIntraSquad ? `${myTeam?.name ?? '?'} A` : (myTeam?.name ?? '?');
  const oppTeamLabel = isIntraSquad ? `${myTeam?.name ?? '?'} B` : (oppTeam?.name ?? '?');

  // タイムアウト
  function getTeamTimeouts(teamId: number, half: 'first' | 'second' | 'overtime'): number {
    return events.filter(e => {
      if (e.team_id !== teamId || e.action !== 'timeout') return false;
      if (half === 'first') return e.quarter <= 2;
      if (half === 'second') return e.quarter >= 3 && e.quarter <= 4;
      return e.quarter >= 5;
    }).length;
  }

  function getTimeoutInfo(teamId: number) {
    if (!categoryConfig) return { used: 0, max: 0 };
    const r = categoryConfig.timeouts;
    if (quarter <= 2) return { used: getTeamTimeouts(teamId, 'first'), max: r.firstHalf };
    if (quarter <= 4) return { used: getTeamTimeouts(teamId, 'second'), max: r.secondHalf };
    return { used: getTeamTimeouts(teamId, 'overtime'), max: r.overtime };
  }

  // ============================================================
  // ハンドラー
  // ============================================================

  function showFB(msg: string) {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2000);
  }

  function getGameTime(): number {
    if (timerRunning) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      return Math.max(0, remainingRef.current - elapsed);
    }
    return remainingRef.current;
  }

  async function toggleTimer() {
    if (timerRunning) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const rem = Math.max(0, remainingRef.current - elapsed);
      remainingRef.current = rem;
      setTimerRunning(false);
      setTimerDisplay(rem);
      await updateGame(gameId, { timer_seconds: rem, timer_running: 0, timer_started_at: null });
    } else {
      if (remainingRef.current <= 0) return;
      startTimeRef.current = Date.now();
      setTimerRunning(true);
      await updateGame(gameId, {
        timer_seconds: remainingRef.current,
        timer_running: 1,
        timer_started_at: Date.now(),
      });
    }
  }

  async function handleTimerManualInput() {
    if (timerRunning) setTimerRunning(false);
    const total = Math.max(0, parseInt(timerInputMin || '0', 10) * 60 + parseInt(timerInputSec || '0', 10));
    remainingRef.current = total;
    setTimerDisplay(total);
    setShowTimerInput(false);
    setTimerInputMin('');
    setTimerInputSec('');
    await updateGame(gameId, { timer_seconds: total, timer_running: 0, timer_started_at: null });
  }

  async function switchQuarter(q: number) {
    if (timerRunning) setTimerRunning(false);
    setQuarter(q);
    const mins = q <= 4 ? (game?.quarter_minutes ?? 10) : (game?.overtime_minutes ?? 5);
    const sec = mins * 60;
    remainingRef.current = sec;
    setTimerDisplay(sec);
    await updateGame(gameId, {
      current_quarter: q, timer_seconds: sec, timer_running: 0, timer_started_at: null,
    });
  }

  function handleSelectPlayer(playerId: number, teamId: number) {
    if (selectedPlayerId === playerId) clearSelection();
    else selectPlayer(playerId, teamId);
  }

  async function handleAction(action: StatAction) {
    if (!selectedPlayerId || !selectedTeamId) {
      showFB('選手を選択してください');
      return;
    }
    const gt = getGameTime();
    const ev = {
      game_id: gameId,
      player_id: selectedPlayerId,
      team_id: selectedTeamId,
      quarter,
      action,
      timestamp: new Date().toISOString(),
      game_time: gt,
      zone: null,
    };
    const id = await insertStatEvent(ev);
    useGameStore.setState({ lastEvent: { ...ev, id } as StatEvent & { id: number } });
    await reloadEvents();
    const allP = [...myPlayers, ...oppPlayers];
    const p = allP.find(pl => pl.id === selectedPlayerId);
    const btn = ALL_STAT_BUTTONS.find(b => b.action === action);
    showFB(`#${p?.number} ${p?.name || ''} ${btn?.label || action}`);
  }

  async function handleUndo() {
    const { lastEvent, undoLast } = useGameStore.getState();
    if (!lastEvent) { showFB('取り消す記録がありません'); return; }
    const allP = [...myPlayers, ...oppPlayers];
    const p = allP.find(pl => pl.id === lastEvent.player_id);
    const btn = ALL_STAT_BUTTONS.find(b => b.action === lastEvent.action);
    await undoLast();
    await reloadEvents();
    showFB(`↩ #${p?.number} ${p?.name || ''} ${btn?.label || lastEvent.action} を取消`);
  }

  async function handleTimeout(teamId: number) {
    const gt = getGameTime();
    await insertStatEvent({
      game_id: gameId, player_id: 0, team_id: teamId, quarter,
      action: 'timeout', timestamp: new Date().toISOString(), game_time: gt, zone: null,
    });
    await reloadEvents();
    showFB(`タイムアウト (${teamId === game?.my_team_id ? myTeamLabel : oppTeamLabel})`);
  }

  async function confirmStartingLineup(
    allIds: number[], mySideIds?: number[], oppSideIds?: number[],
  ) {
    setOnCourtIds(new Set(allIds));
    if (mySideIds) setOnCourtMySideIds(new Set(mySideIds));
    if (oppSideIds) setOnCourtOppSideIds(new Set(oppSideIds));
    const upd: Partial<Game> = { on_court_player_ids: JSON.stringify(allIds) };
    if (mySideIds) upd.on_court_my_side_ids = JSON.stringify(mySideIds);
    if (oppSideIds) upd.on_court_opp_side_ids = JSON.stringify(oppSideIds);
    await updateGame(gameId, upd);
    setShowStartingLineup(false);
  }

  async function handleSubstitution(
    outId: number, inId: number, teamId: number, side?: 'my' | 'opp',
  ) {
    const gt = getGameTime();
    const evTeamId = (isIntraSquad && side === 'opp') ? -teamId : teamId;

    const nextAll = new Set(onCourtIds);
    nextAll.delete(outId);
    nextAll.add(inId);
    const nextMy = new Set(onCourtMySideIds);
    const nextOpp = new Set(onCourtOppSideIds);
    if (isIntraSquad && side === 'my') { nextMy.delete(outId); nextMy.add(inId); }
    if (isIntraSquad && side === 'opp') { nextOpp.delete(outId); nextOpp.add(inId); }

    setOnCourtIds(nextAll);
    setOnCourtMySideIds(nextMy);
    setOnCourtOppSideIds(nextOpp);

    await insertStatEvent({
      game_id: gameId, player_id: outId, team_id: evTeamId, quarter,
      action: 'subOut', timestamp: new Date().toISOString(), game_time: gt, zone: null,
    });
    await insertStatEvent({
      game_id: gameId, player_id: inId, team_id: evTeamId, quarter,
      action: 'subIn', timestamp: new Date().toISOString(), game_time: gt, zone: null,
    });

    const upd: Partial<Game> = { on_court_player_ids: JSON.stringify(Array.from(nextAll)) };
    if (isIntraSquad) {
      upd.on_court_my_side_ids = JSON.stringify(Array.from(nextMy));
      upd.on_court_opp_side_ids = JSON.stringify(Array.from(nextOpp));
    }
    await updateGame(gameId, upd);
    await reloadEvents();

    const allP = [...myPlayers, ...oppPlayers];
    const pO = allP.find(p => p.id === outId);
    const pI = allP.find(p => p.id === inId);
    showFB(`交代: #${pO?.number} OUT → #${pI?.number} IN`);
  }

  // コート図シュート記録
  async function handleCourtShot(zone: ShotZone, is3pt: boolean, made: boolean) {
    if (!selectedPlayerId || !selectedTeamId) {
      showFB('選手を選択してください');
      return;
    }
    const action: StatAction = made
      ? (is3pt ? 'pts3' : 'pts2')
      : (is3pt ? 'miss3' : 'miss2');
    const gt = getGameTime();
    const ev = {
      game_id: gameId,
      player_id: selectedPlayerId,
      team_id: selectedTeamId,
      quarter,
      action,
      timestamp: new Date().toISOString(),
      game_time: gt,
      zone,
    };
    const id = await insertStatEvent(ev);
    useGameStore.setState({ lastEvent: { ...ev, id } as StatEvent & { id: number } });
    await reloadEvents();
    const allP = [...myPlayers, ...oppPlayers];
    const p = allP.find(pl => pl.id === selectedPlayerId);
    const zoneLabel = SHOT_ZONE_INFO[zone].label;
    showFB(`#${p?.number} ${made ? '成功' : '失敗'} ${is3pt ? '3P' : '2P'} (${zoneLabel})`);
  }

  // タイムラインイベント削除
  async function handleDeleteEvent(eventId: number) {
    Alert.alert('確認', 'このイベントを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => {
          await deleteStatEvent(eventId);
          await reloadEvents();
          showFB('イベントを削除しました');
        },
      },
    ]);
  }

  // 試合終了
  function handleEndGame() {
    Alert.alert('試合終了', 'この試合を終了しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '終了', style: 'destructive',
        onPress: async () => {
          if (timerRunning) setTimerRunning(false);
          await updateGame(gameId, {
            status: 'finished' as const,
            timer_running: 0,
            timer_started_at: null,
          });
          router.replace(`/games/${gameId}/summary`);
        },
      },
    ]);
  }

  // ============================================================
  // ローディング
  // ============================================================

  if (!loaded || !game) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </View>
    );
  }

  const hasSelection = selectedPlayerId !== null;
  const myTO = getTimeoutInfo(game.my_team_id);
  const oppTO = getTimeoutInfo(virtualOppTeamId);
  const selectedPlayer = [...myPlayers, ...oppPlayers].find(p => p.id === selectedPlayerId);

  // ============================================================
  // レンダー
  // ============================================================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ═══════════ スコアボード ═══════════ */}
      <View style={styles.scoreboard}>
        {/* スコア行 */}
        <View style={styles.scoreRow}>
          <View style={styles.teamBlock}>
            <Text style={styles.teamNameMy} numberOfLines={1}>{myTeamLabel}</Text>
            <Text style={styles.scoreNum}>{myScore}</Text>
          </View>

          <View style={styles.centerBlock}>
            <Pressable
              onPress={() => setPossession(p => p === 'my' ? 'opp' : 'my')}
              style={styles.possBtn}
            >
              <Text style={[
                styles.possArrow,
                { color: possession === 'my' ? Colors.teamMy : Colors.teamOpp },
              ]}>
                {possession === 'my' ? '◀' : '▶'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.teamBlock}>
            <Text style={styles.teamNameOpp} numberOfLines={1}>{oppTeamLabel}</Text>
            <Text style={styles.scoreNum}>{oppScore}</Text>
          </View>
        </View>

        {/* ファール + タイマー + タイムアウト */}
        <View style={styles.infoRow}>
          <View style={styles.foulToBlock}>
            <Text style={[styles.foulText, myTeamQFouls >= 5 && styles.foulDanger]}>
              F{myTeamQFouls}
            </Text>
            <Pressable onPress={() => handleTimeout(game.my_team_id)} style={styles.toBtn}>
              <Text style={styles.toLabel}>TO</Text>
              <View style={styles.toDots}>
                {Array.from({ length: myTO.max }).map((_, i) => (
                  <View key={i} style={[
                    styles.toDot,
                    i < myTO.max - myTO.used ? styles.toDotMy : styles.toDotUsed,
                  ]} />
                ))}
              </View>
            </Pressable>
          </View>

          <Pressable
            onPress={toggleTimer}
            onLongPress={() => {
              if (timerRunning) {
                const elapsed = (Date.now() - startTimeRef.current) / 1000;
                remainingRef.current = Math.max(0, remainingRef.current - elapsed);
                setTimerRunning(false);
              }
              setTimerInputMin(String(Math.floor(remainingRef.current / 60)));
              setTimerInputSec(String(Math.floor(remainingRef.current % 60)));
              setShowTimerInput(true);
            }}
            style={[styles.timerBtn, timerRunning ? styles.timerRunningBg : styles.timerStoppedBg]}
          >
            <Text style={styles.timerText}>{formatTime(timerDisplay)}</Text>
            <Text style={styles.timerHint}>{timerRunning ? '▶ RUN' : '⏸ STOP'}</Text>
          </Pressable>

          <View style={styles.foulToBlock}>
            <Text style={[styles.foulText, oppTeamQFouls >= 5 && styles.foulDanger]}>
              F{oppTeamQFouls}
            </Text>
            <Pressable onPress={() => handleTimeout(virtualOppTeamId)} style={styles.toBtn}>
              <Text style={styles.toLabel}>TO</Text>
              <View style={styles.toDots}>
                {Array.from({ length: oppTO.max }).map((_, i) => (
                  <View key={i} style={[
                    styles.toDot,
                    i < oppTO.max - oppTO.used ? styles.toDotOpp : styles.toDotUsed,
                  ]} />
                ))}
              </View>
            </Pressable>
          </View>
        </View>

        {/* クォーター切替 */}
        <View style={styles.quarterRow}>
          {[1, 2, 3, 4].map(q => (
            <Pressable
              key={q}
              style={[styles.qBtn, quarter === q && styles.qBtnActive]}
              onPress={() => switchQuarter(q)}
            >
              <Text style={[styles.qBtnText, quarter === q && styles.qBtnTextActive]}>Q{q}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.qBtn, quarter >= 5 && styles.qBtnActive]}
            onPress={() => switchQuarter(quarter >= 5 ? quarter + 1 : 5)}
          >
            <Text style={[styles.qBtnText, quarter >= 5 && styles.qBtnTextActive]}>
              {quarter >= 5 ? getQuarterLabel(quarter) : 'OT'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ═══════════ 選手エリア ═══════════ */}
      <View style={styles.playersRow}>
        <View style={styles.playerCol}>
          <Text style={[styles.colHeader, { color: Colors.teamMy }]}>{myTeamLabel}</Text>
          <ScrollView style={styles.playerScroll} showsVerticalScrollIndicator={false}>
            {myCourt.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                pts={getPlayerPoints(p.id)}
                fouls={getPlayerFouls(p.id)}
                selected={selectedPlayerId === p.id}
                side="my"
                onPress={() => handleSelectPlayer(p.id, game.my_team_id)}
              />
            ))}
            {myCourt.length === 0 && (
              <Text style={styles.noPlayerText}>コート上の選手なし</Text>
            )}
          </ScrollView>
        </View>

        <View style={styles.playerCol}>
          <Text style={[styles.colHeader, { color: Colors.teamOpp }]}>{oppTeamLabel}</Text>
          <ScrollView style={styles.playerScroll} showsVerticalScrollIndicator={false}>
            {oppCourt.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                pts={getPlayerPoints(p.id)}
                fouls={getPlayerFouls(p.id)}
                selected={selectedPlayerId === p.id}
                side="opp"
                onPress={() => handleSelectPlayer(
                  p.id,
                  isIntraSquad ? virtualOppTeamId : game.opponent_team_id,
                )}
              />
            ))}
            {oppCourt.length === 0 && (
              <Text style={styles.noPlayerText}>コート上の選手なし</Text>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ═══════════ フィードバック / 選択表示 ═══════════ */}
      <View style={styles.feedbackBar}>
        {feedback !== '' ? (
          <Text style={styles.feedbackText}>{feedback}</Text>
        ) : hasSelection ? (
          <Text style={styles.selectionText}>
            #{selectedPlayer?.number} {selectedPlayer?.name || ''} を選択中
          </Text>
        ) : (
          <Text style={styles.hintText}>選手をタップして選択</Text>
        )}
      </View>

      {/* ═══════════ スタッツボタン ═══════════ */}
      <View style={styles.statsSection}>
        <View style={styles.statsRow}>
          {STAT_ROW1.map(btn => (
            <Pressable
              key={btn.action}
              style={[
                styles.statBtn,
                btn.cat === 'shoot'
                  ? (hasSelection ? styles.statShoot : styles.statShootOff)
                  : (hasSelection ? styles.statOther : styles.statOtherOff),
              ]}
              onPress={() => handleAction(btn.action)}
              disabled={!hasSelection}
            >
              <Text style={[styles.statBtnText, !hasSelection && styles.statBtnTextOff]}>
                {btn.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.statsRow}>
          {STAT_ROW2.map(btn => (
            <Pressable
              key={btn.action}
              style={[
                styles.statBtn,
                btn.cat === 'shoot'
                  ? (hasSelection ? styles.statMiss : styles.statMissOff)
                  : (hasSelection ? styles.statOther : styles.statOtherOff),
              ]}
              onPress={() => handleAction(btn.action)}
              disabled={!hasSelection}
            >
              <Text style={[styles.statBtnText, !hasSelection && styles.statBtnTextOff]}>
                {btn.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ═══════════ アクションバー (2行) ═══════════ */}
      <View style={styles.actionSection}>
        <View style={styles.actionRow}>
          <Pressable style={styles.undoBtn} onPress={handleUndo}>
            <Text style={styles.actionText}>戻す</Text>
          </Pressable>
          <Pressable style={styles.courtBtn} onPress={() => setShowCourtShot(true)}>
            <Text style={styles.actionText}>コート図</Text>
          </Pressable>
          <Pressable style={styles.memberBtn} onPress={() => setShowMemberChange(true)}>
            <Text style={styles.actionText}>メンバーチェンジ</Text>
          </Pressable>
        </View>
        <View style={[styles.actionRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable style={styles.statsTabBtn} onPress={() => setShowStatsPanel(true)}>
            <Text style={styles.actionText}>スタッツ</Text>
          </Pressable>
          <Pressable style={styles.timelineBtn} onPress={() => setShowTimeline(true)}>
            <Text style={styles.actionText}>タイムライン</Text>
          </Pressable>
          <Pressable style={styles.endGameBtn} onPress={handleEndGame}>
            <Text style={styles.actionText}>試合終了</Text>
          </Pressable>
        </View>
      </View>

      {/* ═══════════ スターティングラインアップ ═══════════ */}
      {showStartingLineup && (
        <StartingLineupPanel
          isIntraSquad={isIntraSquad}
          myPlayers={myPlayers}
          oppPlayers={oppPlayers}
          myTeamLabel={myTeamLabel}
          oppTeamLabel={oppTeamLabel}
          onConfirm={confirmStartingLineup}
          topInset={insets.top}
        />
      )}

      {/* ═══════════ メンバーチェンジ ═══════════ */}
      {showMemberChange && (
        <MemberChangePanel
          isIntraSquad={isIntraSquad}
          myTeamId={game.my_team_id}
          myCourt={myCourt}
          oppCourt={oppCourt}
          myBench={myBench}
          oppBench={oppBench}
          myTeamLabel={myTeamLabel}
          oppTeamLabel={oppTeamLabel}
          onSubstitute={handleSubstitution}
          onClose={() => setShowMemberChange(false)}
          topInset={insets.top}
        />
      )}

      {/* ═══════════ コート図シュートパネル ═══════════ */}
      {showCourtShot && (
        <CourtShotPanel
          selectedPlayerId={selectedPlayerId}
          events={events}
          onShot={handleCourtShot}
          onClose={() => setShowCourtShot(false)}
          topInset={insets.top}
        />
      )}

      {/* ═══════════ スタッツ一覧パネル ═══════════ */}
      {showStatsPanel && (
        <StatsPanel
          events={events}
          myPlayers={myPlayers}
          oppPlayers={oppPlayers}
          myTeamId={game.my_team_id}
          virtualOppTeamId={virtualOppTeamId}
          isIntraSquad={isIntraSquad}
          myTeamLabel={myTeamLabel}
          oppTeamLabel={oppTeamLabel}
          onClose={() => setShowStatsPanel(false)}
          topInset={insets.top}
        />
      )}

      {/* ═══════════ タイムラインパネル ═══════════ */}
      {showTimeline && (
        <TimelinePanel
          events={events}
          allPlayers={[...myPlayers, ...oppPlayers]}
          onDelete={handleDeleteEvent}
          onClose={() => setShowTimeline(false)}
          topInset={insets.top}
        />
      )}

      {/* ═══════════ タイマー入力モーダル ═══════════ */}
      <Modal visible={showTimerInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>タイマー設定</Text>
            <View style={styles.timerInputRow}>
              <TextInput
                style={styles.timerInput}
                value={timerInputMin}
                onChangeText={setTimerInputMin}
                keyboardType="number-pad"
                placeholder="分"
                placeholderTextColor={Colors.textDim}
                maxLength={2}
              />
              <Text style={styles.timerColon}>:</Text>
              <TextInput
                style={styles.timerInput}
                value={timerInputSec}
                onChangeText={setTimerInputSec}
                keyboardType="number-pad"
                placeholder="秒"
                placeholderTextColor={Colors.textDim}
                maxLength={2}
              />
            </View>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setShowTimerInput(false)}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={handleTimerManualInput}>
                <Text style={styles.modalConfirmText}>設定</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// PlayerCard
// ============================================================

function PlayerCard({ player, pts, fouls, selected, side, onPress }: {
  player: Player;
  pts: number;
  fouls: number;
  selected: boolean;
  side: 'my' | 'opp';
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.pCard,
        selected && (side === 'my' ? styles.pCardSelMy : styles.pCardSelOpp),
      ]}
      onPress={onPress}
    >
      <Text style={styles.pNum}>#{player.number}</Text>
      <View style={styles.pInfo}>
        <Text style={styles.pName} numberOfLines={1}>
          {player.name || `選手${player.number}`}
        </Text>
        <Text style={styles.pPts}>{pts}pts</Text>
      </View>
      {fouls > 0 && (
        <View style={[styles.pFoulBadge, fouls >= 5 && styles.pFoulDanger]}>
          <Text style={styles.pFoulText}>F{fouls}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ============================================================
// StartingLineupPanel
// ============================================================

function StartingLineupPanel({ isIntraSquad, myPlayers, oppPlayers, myTeamLabel, oppTeamLabel, onConfirm, topInset }: {
  isIntraSquad: boolean;
  myPlayers: Player[];
  oppPlayers: Player[];
  myTeamLabel: string;
  oppTeamLabel: string;
  onConfirm: (allIds: number[], mySide?: number[], oppSide?: number[]) => void;
  topInset: number;
}) {
  const [mySel, setMySel] = useState<Set<number>>(new Set());
  const [oppSel, setOppSel] = useState<Set<number>>(new Set());

  const toggleMy = (id: number) => {
    if (isIntraSquad && oppSel.has(id)) return;
    const next = new Set(mySel);
    if (next.has(id)) next.delete(id);
    else if (next.size < 5) next.add(id);
    setMySel(next);
  };

  const toggleOpp = (id: number) => {
    if (isIntraSquad && mySel.has(id)) return;
    const next = new Set(oppSel);
    if (next.has(id)) next.delete(id);
    else if (next.size < 5) next.add(id);
    setOppSel(next);
  };

  const canConfirm = mySel.size === 5 && oppSel.size === 5;

  const handleConfirm = () => {
    const myArr = Array.from(mySel);
    const oppArr = Array.from(oppSel);
    if (isIntraSquad) {
      onConfirm([...myArr, ...oppArr], myArr, oppArr);
    } else {
      onConfirm([...myArr, ...oppArr]);
    }
  };

  const oppList = isIntraSquad ? myPlayers : oppPlayers;

  return (
    <View style={[styles.overlayFull, { paddingTop: topInset }]}>
      <View style={styles.slHeader}>
        <Text style={styles.slTitle}>スターティングラインアップ</Text>
        <Text style={styles.slSub}>
          {isIntraSquad
            ? '紅白戦: 同じチームから各サイド5名を選択'
            : '各チーム5名を選択してください'}
        </Text>
      </View>

      <View style={styles.slBody}>
        {/* 自チーム側 */}
        <View style={styles.slCol}>
          <Text style={[styles.slColTitle, { color: Colors.teamMy }]}>
            {myTeamLabel}（{mySel.size}/5）
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {myPlayers.map(p => {
              const isMy = mySel.has(p.id);
              const isOpp = isIntraSquad && oppSel.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.slPlayer,
                    isMy && styles.slPlayerSelMy,
                    isOpp && styles.slPlayerDisabled,
                  ]}
                  onPress={() => toggleMy(p.id)}
                  disabled={isOpp}
                >
                  <Text style={styles.slPlayerNum}>#{p.number}</Text>
                  <Text style={styles.slPlayerName} numberOfLines={1}>
                    {p.name || `選手${p.number}`}
                  </Text>
                  {isMy && <Text style={styles.slCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 相手チーム側 */}
        <View style={styles.slCol}>
          <Text style={[styles.slColTitle, { color: Colors.teamOpp }]}>
            {oppTeamLabel}（{oppSel.size}/5）
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {oppList.map(p => {
              const isO = oppSel.has(p.id);
              const isM = isIntraSquad && mySel.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.slPlayer,
                    isO && styles.slPlayerSelOpp,
                    isM && styles.slPlayerDisabled,
                  ]}
                  onPress={() => toggleOpp(p.id)}
                  disabled={isM}
                >
                  <Text style={styles.slPlayerNum}>#{p.number}</Text>
                  <Text style={styles.slPlayerName} numberOfLines={1}>
                    {p.name || `選手${p.number}`}
                  </Text>
                  {isO && <Text style={styles.slCheckBlue}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <Pressable
        style={[styles.slConfirmBtn, !canConfirm && styles.slConfirmDisabled]}
        onPress={handleConfirm}
        disabled={!canConfirm}
      >
        <Text style={styles.slConfirmText}>
          {canConfirm ? '確定してスタート' : '各チーム5名を選択してください'}
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// MemberChangePanel
// ============================================================

function MemberChangePanel({ isIntraSquad, myTeamId, myCourt, oppCourt, myBench, oppBench, myTeamLabel, oppTeamLabel, onSubstitute, onClose, topInset }: {
  isIntraSquad: boolean;
  myTeamId: number;
  myCourt: Player[];
  oppCourt: Player[];
  myBench: Player[];
  oppBench: Player[];
  myTeamLabel: string;
  oppTeamLabel: string;
  onSubstitute: (outId: number, inId: number, teamId: number, side?: 'my' | 'opp') => void;
  onClose: () => void;
  topInset: number;
}) {
  const [subOutId, setSubOutId] = useState<number | null>(null);
  const [subSide, setSubSide] = useState<'my' | 'opp' | null>(null);

  function selectCourtPlayer(playerId: number, side: 'my' | 'opp') {
    if (subOutId === playerId) {
      setSubOutId(null);
      setSubSide(null);
    } else {
      setSubOutId(playerId);
      setSubSide(side);
    }
  }

  function selectBenchPlayer(playerId: number) {
    if (subOutId === null || subSide === null) return;
    onSubstitute(subOutId, playerId, myTeamId, subSide);
    setSubOutId(null);
    setSubSide(null);
  }

  const benchForSide = subSide === 'my' ? myBench : subSide === 'opp' ? oppBench : [];

  return (
    <View style={[styles.overlayFull, { paddingTop: topInset }]}>
      <View style={styles.mcHeader}>
        <Text style={styles.mcTitle}>メンバーチェンジ</Text>
        <Pressable onPress={onClose} style={styles.mcCloseBtn}>
          <Text style={styles.mcCloseText}>✕ 閉じる</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.mcBody}>
        {/* 自チーム コート */}
        <Text style={[styles.mcSectionTitle, { color: Colors.teamMy }]}>
          {myTeamLabel} - コート上
        </Text>
        <View style={styles.mcPlayerRow}>
          {myCourt.map(p => (
            <Pressable
              key={p.id}
              style={[styles.mcPlayerCard, subOutId === p.id && styles.mcPlayerOut]}
              onPress={() => selectCourtPlayer(p.id, 'my')}
            >
              <Text style={styles.mcPlayerNum}>#{p.number}</Text>
              <Text style={styles.mcPlayerName} numberOfLines={1}>
                {p.name || `選手${p.number}`}
              </Text>
              {subOutId === p.id && <Text style={styles.mcOutLabel}>OUT</Text>}
            </Pressable>
          ))}
        </View>

        {/* 相手チーム コート */}
        <Text style={[styles.mcSectionTitle, { color: Colors.teamOpp }]}>
          {oppTeamLabel} - コート上
        </Text>
        <View style={styles.mcPlayerRow}>
          {oppCourt.map(p => (
            <Pressable
              key={p.id}
              style={[styles.mcPlayerCard, subOutId === p.id && styles.mcPlayerOut]}
              onPress={() => selectCourtPlayer(p.id, 'opp')}
            >
              <Text style={styles.mcPlayerNum}>#{p.number}</Text>
              <Text style={styles.mcPlayerName} numberOfLines={1}>
                {p.name || `選手${p.number}`}
              </Text>
              {subOutId === p.id && <Text style={styles.mcOutLabel}>OUT</Text>}
            </Pressable>
          ))}
        </View>

        {/* ベンチ */}
        {subOutId !== null && (
          <>
            <Text style={styles.mcSectionTitle}>ベンチ（交代先を選択）</Text>
            <View style={styles.mcPlayerRow}>
              {benchForSide.map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.mcPlayerCard, styles.mcPlayerIn]}
                  onPress={() => selectBenchPlayer(p.id)}
                >
                  <Text style={styles.mcPlayerNum}>#{p.number}</Text>
                  <Text style={styles.mcPlayerName} numberOfLines={1}>
                    {p.name || `選手${p.number}`}
                  </Text>
                  <Text style={styles.mcInLabel}>IN</Text>
                </Pressable>
              ))}
              {benchForSide.length === 0 && (
                <Text style={styles.noPlayerText}>ベンチに選手がいません</Text>
              )}
            </View>
          </>
        )}

        {subOutId === null && (
          <Text style={styles.mcHint}>
            コート上の選手をタップして交代対象を選択してください
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// CourtShotPanel — コート図シュート記録
// ============================================================

function CourtShotPanel({ selectedPlayerId, events, onShot, onClose, topInset }: {
  selectedPlayerId: number | null;
  events: StatEvent[];
  onShot: (zone: ShotZone, is3pt: boolean, made: boolean) => void;
  onClose: () => void;
  topInset: number;
}) {
  const [pendingZone, setPendingZone] = useState<{ zone: ShotZone; is3pt: boolean } | null>(null);

  const shotEvents = useMemo(() =>
    events
      .filter(e => e.player_id === selectedPlayerId && e.zone)
      .map(e => ({ zone: e.zone!, action: e.action })),
    [events, selectedPlayerId]);

  function handleZoneTap(zone: ShotZone, is3pt: boolean) {
    setPendingZone({ zone, is3pt });
  }

  function handleResult(made: boolean) {
    if (!pendingZone) return;
    onShot(pendingZone.zone, pendingZone.is3pt, made);
    setPendingZone(null);
  }

  return (
    <View style={[styles.overlayFull, { paddingTop: topInset }]}>
      <View style={styles.mcHeader}>
        <Text style={styles.mcTitle}>シュートチャート</Text>
        <Pressable onPress={onClose} style={styles.mcCloseBtn}>
          <Text style={styles.mcCloseText}>✕ 閉じる</Text>
        </Pressable>
      </View>

      {!selectedPlayerId && (
        <Text style={[styles.mcHint, { marginTop: 40 }]}>
          先に選手を選択してからコート図を開いてください
        </Text>
      )}

      {selectedPlayerId && (
        <View style={styles.courtWrap}>
          <CourtSvg
            onZoneTap={handleZoneTap}
            disabled={!!pendingZone}
            shotEvents={shotEvents}
          />

          {pendingZone && (
            <View style={styles.shotChoiceOverlay}>
              <Text style={styles.shotChoiceTitle}>
                {SHOT_ZONE_INFO[pendingZone.zone].label} — {pendingZone.is3pt ? '3P' : '2P'}
              </Text>
              <View style={styles.shotChoiceRow}>
                <Pressable
                  style={[styles.shotChoiceBtn, { backgroundColor: Colors.success }]}
                  onPress={() => handleResult(true)}
                >
                  <Text style={styles.shotChoiceBtnText}>成功</Text>
                </Pressable>
                <Pressable
                  style={[styles.shotChoiceBtn, { backgroundColor: Colors.danger }]}
                  onPress={() => handleResult(false)}
                >
                  <Text style={styles.shotChoiceBtnText}>失敗</Text>
                </Pressable>
                <Pressable
                  style={[styles.shotChoiceBtn, { backgroundColor: Colors.surfaceLight }]}
                  onPress={() => setPendingZone(null)}
                >
                  <Text style={styles.shotChoiceBtnText}>キャンセル</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================================
// StatsPanel — スタッツ一覧
// ============================================================

function StatsPanel({ events, myPlayers, oppPlayers, myTeamId, virtualOppTeamId, isIntraSquad, myTeamLabel, oppTeamLabel, onClose, topInset }: {
  events: StatEvent[];
  myPlayers: Player[];
  oppPlayers: Player[];
  myTeamId: number;
  virtualOppTeamId: number;
  isIntraSquad: boolean;
  myTeamLabel: string;
  oppTeamLabel: string;
  onClose: () => void;
  topInset: number;
}) {
  const [tab, setTab] = useState<'my' | 'opp'>('my');

  const players = tab === 'my' ? myPlayers : (isIntraSquad ? myPlayers : oppPlayers);
  const teamId = tab === 'my' ? myTeamId : virtualOppTeamId;

  // 紅白戦のB側選手フィルター用
  const playerStatsData = useMemo(() => {
    const result: { player: Player; stats: PlayerStats }[] = [];
    let teamTotal = emptyStats();

    for (const p of players) {
      const pEvents = events.filter(e => {
        if (e.player_id !== p.id) return false;
        if (isIntraSquad) return e.team_id === teamId;
        return true;
      });
      const st = calcPlayerStats(pEvents);
      result.push({ player: p, stats: st });
      teamTotal = mergeStats(teamTotal, st);
    }
    return { rows: result, total: teamTotal };
  }, [events, players, teamId, isIntraSquad]);

  const COLS = ['PTS', 'FG', '3P', 'FT', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FOUL'];

  function statCell(s: PlayerStats, col: string): string {
    switch (col) {
      case 'PTS': return String(s.pts);
      case 'FG': return `${s.fg}/${s.fga}`;
      case '3P': return `${s.tp}/${s.tpa}`;
      case 'FT': return `${s.ft}/${s.fta}`;
      case 'REB': return String(s.reb);
      case 'AST': return String(s.ast);
      case 'STL': return String(s.stl);
      case 'BLK': return String(s.blk);
      case 'TO': return String(s.to);
      case 'FOUL': return String(s.foul);
      default: return '';
    }
  }

  return (
    <View style={[styles.overlayFull, { paddingTop: topInset }]}>
      <View style={styles.mcHeader}>
        <Text style={styles.mcTitle}>スタッツ一覧</Text>
        <Pressable onPress={onClose} style={styles.mcCloseBtn}>
          <Text style={styles.mcCloseText}>✕ 閉じる</Text>
        </Pressable>
      </View>

      {/* タブ切替 */}
      <View style={styles.spTabRow}>
        <Pressable
          style={[styles.spTab, tab === 'my' && styles.spTabActiveMy]}
          onPress={() => setTab('my')}
        >
          <Text style={[styles.spTabText, tab === 'my' && styles.spTabTextActive]}>{myTeamLabel}</Text>
        </Pressable>
        <Pressable
          style={[styles.spTab, tab === 'opp' && styles.spTabActiveOpp]}
          onPress={() => setTab('opp')}
        >
          <Text style={[styles.spTabText, tab === 'opp' && styles.spTabTextActive]}>{oppTeamLabel}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* ヘッダー */}
          <View style={styles.spHeaderRow}>
            <Text style={[styles.spCell, styles.spNameCell, styles.spHeaderText]}>#</Text>
            <Text style={[styles.spCell, styles.spNameCell, styles.spHeaderText]}>名前</Text>
            {COLS.map(c => (
              <Text key={c} style={[styles.spCell, styles.spHeaderText]}>{c}</Text>
            ))}
          </View>

          {/* 選手行 */}
          <ScrollView style={{ maxHeight: 400 }}>
            {playerStatsData.rows.map(({ player, stats }) => (
              <View key={player.id} style={styles.spRow}>
                <Text style={[styles.spCell, styles.spNameCell, styles.spNumText]}>
                  {player.number}
                </Text>
                <Text style={[styles.spCell, styles.spNameCell]} numberOfLines={1}>
                  {player.name || `選手${player.number}`}
                </Text>
                {COLS.map(c => (
                  <Text key={c} style={styles.spCell}>{statCell(stats, c)}</Text>
                ))}
              </View>
            ))}

            {/* 合計行 */}
            <View style={[styles.spRow, styles.spTotalRow]}>
              <Text style={[styles.spCell, styles.spNameCell, styles.spTotalText]}>合計</Text>
              <Text style={[styles.spCell, styles.spNameCell]} />
              {COLS.map(c => (
                <Text key={c} style={[styles.spCell, styles.spTotalText]}>
                  {statCell(playerStatsData.total, c)}
                </Text>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================
// TimelinePanel — タイムライン
// ============================================================

function TimelinePanel({ events, allPlayers, onDelete, onClose, topInset }: {
  events: StatEvent[];
  allPlayers: Player[];
  onDelete: (eventId: number) => void;
  onClose: () => void;
  topInset: number;
}) {
  const ACTION_LABELS: Record<string, string> = {
    pts2: '2P成功', pts3: '3P成功', ft: 'FT成功',
    miss2: '2Pミス', miss3: '3Pミス', missFt: 'FTミス',
    reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK',
    to: 'TO', foul: 'FOUL', subIn: 'IN', subOut: 'OUT', timeout: 'タイムアウト',
  };

  // 新しいイベントが上に来るように逆順
  const reversed = useMemo(() => [...events].reverse(), [events]);

  return (
    <View style={[styles.overlayFull, { paddingTop: topInset }]}>
      <View style={styles.mcHeader}>
        <Text style={styles.mcTitle}>タイムライン</Text>
        <Pressable onPress={onClose} style={styles.mcCloseBtn}>
          <Text style={styles.mcCloseText}>✕ 閉じる</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.mcBody}>
        {reversed.length === 0 && (
          <Text style={styles.mcHint}>まだ記録がありません</Text>
        )}
        {reversed.map(ev => {
          const p = allPlayers.find(pl => pl.id === ev.player_id);
          const label = ACTION_LABELS[ev.action] || ev.action;
          const timeStr = ev.game_time != null ? formatTime(ev.game_time) : '';
          const zoneStr = ev.zone ? ` (${SHOT_ZONE_INFO[ev.zone as ShotZone]?.label || ev.zone})` : '';

          return (
            <View key={ev.id} style={styles.tlRow}>
              <View style={styles.tlInfo}>
                <Text style={styles.tlQuarter}>Q{ev.quarter}</Text>
                {timeStr !== '' && <Text style={styles.tlTime}>{timeStr}</Text>}
                <Text style={styles.tlPlayer}>
                  {ev.player_id === 0 ? '' : `#${p?.number ?? '?'} ${p?.name || ''}`}
                </Text>
                <Text style={styles.tlAction}>{label}{zoneStr}</Text>
              </View>
              <Pressable onPress={() => onDelete(ev.id)} style={styles.tlDeleteBtn}>
                <Text style={styles.tlDeleteText}>削除</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: 18 },

  // ─── スコアボード ───
  scoreboard: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  teamBlock: { flex: 1, alignItems: 'center' },
  teamNameMy: {
    fontSize: 14, fontWeight: 'bold', color: Colors.teamMy, marginBottom: 2,
  },
  teamNameOpp: {
    fontSize: 14, fontWeight: 'bold', color: Colors.teamOpp, marginBottom: 2,
  },
  scoreNum: {
    fontSize: 42, fontWeight: 'bold', color: Colors.white, lineHeight: 48,
  },
  centerBlock: { width: 48, alignItems: 'center' },
  possBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  possArrow: { fontSize: 22, fontWeight: 'bold' },

  // ─── ファール + タイマー ───
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  foulToBlock: { flex: 1, alignItems: 'center', gap: 4 },
  foulText: {
    fontSize: 16, fontWeight: 'bold', color: Colors.textMuted,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, overflow: 'hidden',
  },
  foulDanger: { color: Colors.white, backgroundColor: Colors.danger },
  toBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  toLabel: { fontSize: 12, fontWeight: 'bold', color: Colors.textDim },
  toDots: { flexDirection: 'row', gap: 3 },
  toDot: { width: 8, height: 8, borderRadius: 4 },
  toDotMy: { backgroundColor: Colors.teamMy },
  toDotOpp: { backgroundColor: Colors.teamOpp },
  toDotUsed: { backgroundColor: Colors.surfaceLight },

  timerBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 12, alignItems: 'center', minWidth: 110,
  },
  timerRunningBg: { backgroundColor: '#166534' },
  timerStoppedBg: { backgroundColor: '#991b1b' },
  timerText: {
    fontSize: 28, fontWeight: 'bold', color: Colors.white,
    fontVariant: ['tabular-nums'],
  },
  timerHint: { fontSize: 10, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)' },

  // ─── クォーター ───
  quarterRow: {
    flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 4,
  },
  qBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, backgroundColor: Colors.surfaceLight,
  },
  qBtnActive: { backgroundColor: Colors.accent },
  qBtnText: { fontSize: 14, fontWeight: 'bold', color: Colors.textDim },
  qBtnTextActive: { color: Colors.white },

  // ─── 選手エリア ───
  playersRow: {
    flex: 1, flexDirection: 'row', gap: 8,
    paddingHorizontal: 8, paddingTop: 6,
  },
  playerCol: { flex: 1 },
  colHeader: {
    fontSize: 13, fontWeight: 'bold', textAlign: 'center',
    marginBottom: 4,
  },
  playerScroll: { flex: 1 },
  noPlayerText: {
    fontSize: 13, color: Colors.textDim, textAlign: 'center', paddingVertical: 12,
  },

  // ─── PlayerCard ───
  pCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10,
    marginBottom: 4, borderWidth: 2, borderColor: 'transparent',
  },
  pCardSelMy: { borderColor: Colors.teamMy, backgroundColor: '#431407' },
  pCardSelOpp: { borderColor: Colors.teamOpp, backgroundColor: '#172554' },
  pNum: {
    fontSize: 20, fontWeight: 'bold', color: Colors.white, width: 44,
  },
  pInfo: { flex: 1 },
  pName: { fontSize: 14, color: Colors.text },
  pPts: { fontSize: 12, color: Colors.textMuted },
  pFoulBadge: {
    backgroundColor: Colors.surfaceLight, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  pFoulDanger: { backgroundColor: Colors.danger },
  pFoulText: { fontSize: 11, fontWeight: 'bold', color: Colors.white },

  // ─── フィードバック ───
  feedbackBar: {
    height: 32, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surface, marginHorizontal: 8,
    borderRadius: 8, marginVertical: 4,
  },
  feedbackText: { fontSize: 14, fontWeight: 'bold', color: Colors.accent },
  selectionText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  hintText: { fontSize: 13, color: Colors.textDim },

  // ─── スタッツボタン ───
  statsSection: { paddingHorizontal: 8, gap: 4, paddingBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 4 },
  statBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  statShoot: { backgroundColor: '#16a34a' },
  statShootOff: { backgroundColor: '#14532d' },
  statMiss: { backgroundColor: '#b45309' },
  statMissOff: { backgroundColor: '#451a03' },
  statOther: { backgroundColor: '#0284c7' },
  statOtherOff: { backgroundColor: '#0c4a6e' },
  statBtnText: { fontSize: 13, fontWeight: 'bold', color: Colors.white },
  statBtnTextOff: { color: 'rgba(255,255,255,0.3)' },

  // ─── アクションバー ───
  actionSection: { paddingHorizontal: 8, gap: 4, paddingTop: 4 },
  actionRow: { flexDirection: 'row', gap: 4 },
  undoBtn: {
    flex: 1, backgroundColor: '#a16207', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  courtBtn: {
    flex: 1, backgroundColor: '#6d28d9', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  memberBtn: {
    flex: 1.5, backgroundColor: '#0f766e', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  statsTabBtn: {
    flex: 1, backgroundColor: Colors.info, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  timelineBtn: {
    flex: 1, backgroundColor: '#475569', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  endGameBtn: {
    flex: 1, backgroundColor: Colors.danger, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  actionText: { fontSize: 13, fontWeight: 'bold', color: Colors.white },

  // ─── オーバーレイ共通 ───
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 100,
  },

  // ─── スターティングラインアップ ───
  slHeader: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  slTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  slSub: { fontSize: 13, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  slBody: { flex: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 12 },
  slCol: { flex: 1 },
  slColTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  slPlayer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    marginBottom: 4, borderWidth: 2, borderColor: 'transparent',
  },
  slPlayerSelMy: { borderColor: Colors.teamMy, backgroundColor: '#431407' },
  slPlayerSelOpp: { borderColor: Colors.teamOpp, backgroundColor: '#172554' },
  slPlayerDisabled: { opacity: 0.3 },
  slPlayerNum: { fontSize: 18, fontWeight: 'bold', color: Colors.white, width: 44 },
  slPlayerName: { flex: 1, fontSize: 14, color: Colors.text },
  slCheck: { fontSize: 18, fontWeight: 'bold', color: Colors.teamMy },
  slCheckBlue: { fontSize: 18, fontWeight: 'bold', color: Colors.teamOpp },
  slConfirmBtn: {
    backgroundColor: Colors.success, borderRadius: 14,
    paddingVertical: 18, marginHorizontal: 16, marginVertical: 12,
    alignItems: 'center',
  },
  slConfirmDisabled: { backgroundColor: Colors.surfaceLight },
  slConfirmText: { fontSize: 18, fontWeight: 'bold', color: Colors.white },

  // ─── メンバーチェンジ ───
  mcHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  mcTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  mcCloseBtn: {
    backgroundColor: Colors.surfaceLight, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  mcCloseText: { fontSize: 14, fontWeight: 'bold', color: Colors.textMuted },
  mcBody: { flex: 1, paddingHorizontal: 12 },
  mcSectionTitle: {
    fontSize: 15, fontWeight: 'bold', color: Colors.text,
    marginTop: 12, marginBottom: 6,
  },
  mcPlayerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mcPlayerCard: {
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', minWidth: 80,
  },
  mcPlayerOut: { borderColor: Colors.danger, backgroundColor: '#450a0a' },
  mcPlayerIn: { borderColor: Colors.success, backgroundColor: '#052e16' },
  mcPlayerNum: { fontSize: 18, fontWeight: 'bold', color: Colors.white },
  mcPlayerName: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  mcOutLabel: { fontSize: 10, fontWeight: 'bold', color: Colors.danger, marginTop: 2 },
  mcInLabel: { fontSize: 10, fontWeight: 'bold', color: Colors.success, marginTop: 2 },
  mcHint: {
    fontSize: 14, color: Colors.textDim, textAlign: 'center',
    paddingVertical: 24,
  },

  // ─── タイマー入力モーダル ───
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 24, width: 280,
  },
  modalTitle: {
    fontSize: 18, fontWeight: 'bold', color: Colors.text,
    textAlign: 'center', marginBottom: 16,
  },
  timerInputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  timerInput: {
    backgroundColor: Colors.surfaceLight, color: Colors.white,
    fontSize: 28, fontWeight: 'bold', textAlign: 'center',
    width: 72, paddingVertical: 12, borderRadius: 10,
  },
  timerColon: { fontSize: 28, fontWeight: 'bold', color: Colors.white },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancel: {
    flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalCancelText: { fontSize: 16, fontWeight: 'bold', color: Colors.textMuted },
  modalConfirm: {
    flex: 1, backgroundColor: Colors.accent, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalConfirmText: { fontSize: 16, fontWeight: 'bold', color: Colors.white },

  // ─── コート図パネル ───
  courtWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingBottom: 24,
  },
  shotChoiceOverlay: {
    position: 'absolute', bottom: 40, left: 24, right: 24,
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  shotChoiceTitle: {
    fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 12,
  },
  shotChoiceRow: { flexDirection: 'row', gap: 8 },
  shotChoiceBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
  },
  shotChoiceBtnText: { fontSize: 16, fontWeight: 'bold', color: Colors.white },

  // ─── スタッツパネル ───
  spTabRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8,
  },
  spTab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surfaceLight, alignItems: 'center',
  },
  spTabActiveMy: { backgroundColor: Colors.teamMy },
  spTabActiveOpp: { backgroundColor: Colors.teamOpp },
  spTabText: { fontSize: 14, fontWeight: 'bold', color: Colors.textMuted },
  spTabTextActive: { color: Colors.white },
  spHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  spHeaderText: { fontWeight: 'bold', color: Colors.textMuted, fontSize: 11 },
  spRow: {
    flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  spTotalRow: { backgroundColor: Colors.surfaceLight },
  spCell: {
    width: 48, fontSize: 12, color: Colors.text, textAlign: 'center',
  },
  spNameCell: { width: 60, textAlign: 'left' },
  spNumText: { fontWeight: 'bold', color: Colors.white },
  spTotalText: { fontWeight: 'bold', color: Colors.accent },

  // ─── タイムライン ───
  tlRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
  },
  tlInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tlQuarter: {
    fontSize: 11, fontWeight: 'bold', color: Colors.accent,
    backgroundColor: Colors.surfaceLight, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, overflow: 'hidden',
  },
  tlTime: { fontSize: 11, color: Colors.textDim, fontVariant: ['tabular-nums'] },
  tlPlayer: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tlAction: { fontSize: 12, color: Colors.textMuted },
  tlDeleteBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(220,38,38,0.2)', borderRadius: 6,
  },
  tlDeleteText: { fontSize: 11, fontWeight: 'bold', color: Colors.danger },
});
