import { useState } from 'react';
import { View, StyleSheet, Pressable, Text, type DimensionValue } from 'react-native';
import Svg, { Rect, Path, Circle, Line, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import type { ShotZone } from '@/lib/types';
import { SHOT_ZONE_INFO } from '@/lib/types';

// ============================================================
// コート図 viewBox: 0 0 300 280 (ハーフコート)
// ============================================================

// 9ゾーン定義 — タップ領域の座標
interface ZoneDef {
  zone: ShotZone;
  // タッチ領域 (x, y, w, h)
  x: number; y: number; w: number; h: number;
}

const ZONES: ZoneDef[] = [
  // ペイント (中央の狭いエリア)
  { zone: 'paint',              x: 100, y: 170, w: 100, h: 100 },
  // ミドル
  { zone: 'midLeft',            x: 40,  y: 140, w: 60,  h: 100 },
  { zone: 'midCenter',         x: 100, y: 100, w: 100, h: 70 },
  { zone: 'midRight',           x: 200, y: 140, w: 60,  h: 100 },
  // 3Pゾーン
  { zone: 'threeLeftCorner',    x: 0,   y: 190, w: 40,  h: 80 },
  { zone: 'threeLeftWing',      x: 0,   y: 80,  w: 60,  h: 110 },
  { zone: 'threeTop',           x: 60,  y: 0,   w: 180, h: 100 },
  { zone: 'threeRightWing',     x: 240, y: 80,  w: 60,  h: 110 },
  { zone: 'threeRightCorner',   x: 260, y: 190, w: 40,  h: 80 },
];

interface Props {
  onZoneTap: (zone: ShotZone, is3pt: boolean) => void;
  disabled?: boolean;
  shotEvents?: { zone: string; action: string }[];
}

export default function CourtSvg({ onZoneTap, disabled, shotEvents = [] }: Props) {
  const [activeZone, setActiveZone] = useState<ShotZone | null>(null);

  // ゾーンごとの成功/失敗カウント
  function getZoneStats(zone: ShotZone) {
    let made = 0, missed = 0;
    for (const e of shotEvents) {
      if (e.zone !== zone) continue;
      if (e.action === 'pts2' || e.action === 'pts3' || e.action === 'ft') made++;
      else if (e.action === 'miss2' || e.action === 'miss3') missed++;
    }
    return { made, missed };
  }

  function handleZoneTap(zone: ShotZone) {
    if (disabled) return;
    const info = SHOT_ZONE_INFO[zone];
    onZoneTap(zone, info.is3pt);
  }

  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 300 280" style={styles.svg}>
        {/* コート背景 */}
        <Rect x="0" y="0" width="300" height="280" fill={Colors.court} rx="4" />

        {/* コート境界線 */}
        <Rect x="5" y="5" width="290" height="270" fill="none"
          stroke="#2d5a3a" strokeWidth="2" />

        {/* 3ポイントライン (アーチ) */}
        <Path
          d="M 30 275 L 30 190 Q 30 40 150 30 Q 270 40 270 190 L 270 275"
          fill="none" stroke="#3a7a4a" strokeWidth="2"
        />

        {/* フリースローレーン */}
        <Rect x="100" y="175" width="100" height="100"
          fill="none" stroke="#3a7a4a" strokeWidth="1.5" />

        {/* フリースロー円 */}
        <Circle cx="150" cy="175" r="30"
          fill="none" stroke="#3a7a4a" strokeWidth="1.5" />

        {/* リング */}
        <Circle cx="150" cy="255" r="8"
          fill="none" stroke="#e5a030" strokeWidth="2" />

        {/* バックボード */}
        <Line x1="130" y1="268" x2="170" y2="268"
          stroke="#888" strokeWidth="2" />

        {/* ゾーンラベル (常時表示) */}
        {ZONES.map(z => {
          const { made, missed } = getZoneStats(z.zone);
          const total = made + missed;
          const cx = z.x + z.w / 2;
          const cy = z.y + z.h / 2;
          if (total === 0) return null;
          return (
            <G key={z.zone}>
              <Circle cx={cx} cy={cy} r="14" fill="rgba(0,0,0,0.5)" />
              <Svg x={cx - 14} y={cy - 8} width="28" height="16">
                <Rect width="28" height="16" fill="transparent" />
              </Svg>
            </G>
          );
        })}
      </Svg>

      {/* タップ領域オーバーレイ */}
      {ZONES.map(z => {
        const info = SHOT_ZONE_INFO[z.zone];
        const { made, missed } = getZoneStats(z.zone);
        const total = made + missed;
        // パーセンテージ表示用の比率を計算（SVG viewBox 300x280 → View実サイズ）
        const left = `${(z.x / 300) * 100}%` as DimensionValue;
        const top = `${(z.y / 280) * 100}%` as DimensionValue;
        const width = `${(z.w / 300) * 100}%` as DimensionValue;
        const height = `${(z.h / 280) * 100}%` as DimensionValue;

        return (
          <Pressable
            key={z.zone}
            style={[
              styles.zoneTouch,
              { left, top, width, height },
              activeZone === z.zone && styles.zoneTouchActive,
            ]}
            onPressIn={() => setActiveZone(z.zone)}
            onPressOut={() => setActiveZone(null)}
            onPress={() => handleZoneTap(z.zone)}
            disabled={disabled}
          >
            {total > 0 && (
              <View style={styles.zoneStat}>
                <Text style={styles.zoneStatText}>
                  {made}/{total}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 300 / 280,
    position: 'relative',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  zoneTouch: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneTouchActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  zoneStat: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  zoneStatText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.white,
  },
});
