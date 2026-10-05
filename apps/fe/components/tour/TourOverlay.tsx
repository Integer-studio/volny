import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTour } from './TourProvider';
import { COACH_STEPS, type TourScreen } from './steps';
import TipCard from './TipCard';
import { EMBER, SCRIM } from './colors';

type Box = { x: number; y: number; w: number; h: number };
type Hole = { box: Box; shape: 'circle' | 'rect'; radius: number };

/** Kolik vzduchu nechat mezi cílem a hranou výřezu. */
const PAD = 8;
const RECT_RADIUS = 18;
const CARD_GAP = 14;
const CARD_MAX_W = 360;
/** Cíl se může hýbat (Reveal, rolování, změna velikosti okna) - místo hlídání
 * každé z těch příčin se pozice prostě přeměřuje. Je to pár volání
 * measureInWindow za sekundu a jen dokud nápověda běží. */
const REMEASURE_MS = 250;

/**
 * Ztmavení obrazovky s výřezem nad cílem + karta s nápovědou (task 0019).
 *
 * Vykresluje se zvlášť na každé obrazovce (`screen`), ne jednou v kořeni:
 * modální obrazovky stacku by jinak mohly ležet nad ním. Klepnutí uvnitř
 * výřezu propadnou na skutečné UI, zbytek obrazovky je zablokovaný.
 */
export default function TourOverlay({ screen }: { screen: TourScreen }) {
  const { step, advance, skip, getTarget } = useTour();
  const config = step ? COACH_STEPS[step] : undefined;
  const active = !!config && config.screen === screen;

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const rootRef = useRef<View>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);

  useEffect(() => {
    setHole(null);
    if (!active || !focused || !config) return;

    let alive = true;
    const measure = () => {
      const target = getTarget(config.target)?.current;
      const root = rootRef.current;
      if (!target || !root) return;
      root.measureInWindow((rx, ry) => {
        target.measureInWindow((x, y, w, h) => {
          if (!alive || w === 0 || h === 0) return;
          const box =
            config.shape === 'circle'
              ? (() => {
                  const r = Math.max(w, h) / 2 + PAD;
                  const cx = x - rx + w / 2;
                  const cy = y - ry + h / 2;
                  return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
                })()
              : { x: x - rx - PAD, y: y - ry - PAD, w: w + PAD * 2, h: h + PAD * 2 };
          const radius = config.shape === 'circle' ? box.w / 2 : RECT_RADIUS;
          setHole(prev =>
            prev &&
            Math.abs(prev.box.x - box.x) < 0.5 &&
            Math.abs(prev.box.y - box.y) < 0.5 &&
            Math.abs(prev.box.w - box.w) < 0.5 &&
            Math.abs(prev.box.h - box.h) < 0.5
              ? prev
              : { box, shape: config.shape, radius },
          );
        });
      });
    };

    measure();
    const t = setInterval(measure, REMEASURE_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [active, focused, config, getTarget]);

  const reduceMotion = useReduceMotion();
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const visible = active && focused && !!hole && !!size;

  // Jediný ambientní pohyb celého průvodce: pomalé "dýchání" lemu výřezu,
  // které opakuje motiv prstence. Při omezeném pohybu zůstane lem statický.
  useEffect(() => {
    if (!visible) {
      appear.setValue(0);
      return;
    }
    Animated.timing(appear, {
      toValue: 1,
      duration: reduceMotion ? 120 : 220,
      useNativeDriver: true,
    }).start();
    if (reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, step, reduceMotion]);

  return (
    <View
      ref={rootRef}
      collapsable={false}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {visible && hole && size && config && step && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]} pointerEvents="box-none">
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={size.w} height={size.h}>
              <Path d={scrimPath(size, hole)} fill={SCRIM} fillRule="evenodd" />
            </Svg>
          </View>

          <Blockers size={size} box={hole.box} />

          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hole.box.x,
              top: hole.box.y,
              width: hole.box.w,
              height: hole.box.h,
              borderRadius: hole.radius,
              borderWidth: 2,
              borderColor: EMBER,
              opacity: reduceMotion ? 0.9 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0] }),
              transform: reduceMotion
                ? []
                : [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, hole.shape === 'circle' ? 1.08 : 1.04] }) }],
            }}
          />

          <PlacedCard
            size={size}
            box={hole.box}
            step={step}
            title={config.title}
            body={config.body}
            action={config.action}
            gap={config.cardGap ?? CARD_GAP}
            onAction={() => {
              advance(step);
              if (config.backAfter && router.canGoBack()) router.back();
            }}
            onSkip={skip}
          />
        </Animated.View>
      )}
    </View>
  );
}

function scrimPath(size: { w: number; h: number }, hole: Hole): string {
  const outer = `M0 0H${size.w}V${size.h}H0Z`;
  const { x, y, w, h } = hole.box;
  if (hole.shape === 'circle') {
    const r = w / 2;
    return `${outer} M${x} ${y + r} a${r} ${r} 0 1 0 ${w} 0 a${r} ${r} 0 1 0 ${-w} 0Z`;
  }
  const r = Math.min(hole.radius, w / 2, h / 2);
  return (
    `${outer} M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h - r}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}H${x + r}a${r} ${r} 0 0 1 ${-r} ${-r}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  );
}

/** Čtyři pruhy kolem výřezu, které pohltí klepnutí mimo cíl. */
function Blockers({ size, box }: { size: { w: number; h: number }; box: Box }) {
  const swallow = { onStartShouldSetResponder: () => true };
  const top = Math.max(0, box.y);
  const bottom = Math.min(size.h, box.y + box.h);
  return (
    <>
      <View {...swallow} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: top }} />
      <View {...swallow} style={{ position: 'absolute', left: 0, right: 0, top: bottom, bottom: 0 }} />
      <View {...swallow} style={{ position: 'absolute', left: 0, width: Math.max(0, box.x), top, height: bottom - top }} />
      <View
        {...swallow}
        style={{ position: 'absolute', left: box.x + box.w, right: 0, top, height: bottom - top }}
      />
    </>
  );
}

function PlacedCard({
  size,
  box,
  step,
  title,
  body,
  action,
  gap,
  onAction,
  onSkip,
}: {
  size: { w: number; h: number };
  box: Box;
  step: NonNullable<ReturnType<typeof useTour>['step']>;
  title: string;
  body?: string;
  action?: string;
  gap: number;
  onAction: () => void;
  onSkip: () => void;
}) {
  const cardW = Math.min(size.w - 32, CARD_MAX_W);
  const left = Math.max(16, (size.w - cardW) / 2);
  const spaceBelow = size.h - (box.y + box.h);
  const below = spaceBelow >= box.y;
  const cx = box.x + box.w / 2;
  const notchX = Math.min(Math.max(cx - left, 28), cardW - 28);

  return (
    <View
      style={{
        position: 'absolute',
        left,
        width: cardW,
        ...(below
          ? { top: Math.min(box.y + box.h + gap, size.h - 16) }
          : { bottom: Math.min(size.h - box.y + gap, size.h - 16) }),
      }}
    >
      <TipCard
        step={step}
        title={title}
        body={body}
        action={action}
        onAction={onAction}
        onSkip={onSkip}
        notch={{ side: below ? 'top' : 'bottom', x: notchX }}
      />
    </View>
  );
}
