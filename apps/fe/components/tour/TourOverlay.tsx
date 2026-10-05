import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTour } from './TourProvider';
import { COACH_STEPS, type TourScreen } from './steps';
import TipCard from './TipCard';
import { EMBER, SCRIM } from './colors';
import { isOnboardingStep } from '../../lib/tour';

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

/** Délka přejezdu výřezu z jednoho cíle na druhý. */
const GLIDE_MS = 260;

// Ztmavení se plynule rozsvítí jen poprvé za průvodce. Při přechodech mezi
// kroky a obrazovkami už musí být tmavé hned, jinak by obrazovka mezi
// nápovědami problikla nezatemněná.
let everShown = false;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpHole(from: Hole, to: Hole, t: number): Hole {
  return {
    box: {
      x: lerp(from.box.x, to.box.x, t),
      y: lerp(from.box.y, to.box.y, t),
      w: lerp(from.box.w, to.box.w, t),
      h: lerp(from.box.h, to.box.h, t),
    },
    shape: t < 0.5 ? from.shape : to.shape,
    radius: lerp(from.radius, to.radius, t),
  };
}

/**
 * Ztmavení obrazovky s výřezem nad cílem + karta s nápovědou (task 0019).
 *
 * Vykresluje se zvlášť na každé obrazovce (`screen`), ne jednou v kořeni:
 * modální obrazovky stacku by jinak mohly ležet nad ním. Klepnutí uvnitř
 * výřezu propadnou na skutečné UI, zbytek obrazovky je zablokovaný.
 *
 * Ztmavení drží i ve chvílích, kdy tahle obrazovka zrovna nápovědu nemá,
 * ale průvodce běží jinde: obrazovka pod otevírající se modální obrazovkou
 * a modální obrazovka, která se po "Rozumím" zavírá. Přesně tam dřív
 * problikla nezatemněná.
 */
export default function TourOverlay({ screen }: { screen: TourScreen }) {
  const { step, advance, skip, getTarget } = useTour();
  const config = step ? COACH_STEPS[step] : undefined;
  const active = !!config && config.screen === screen;
  const coaching = step != null && !isOnboardingStep(step);

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Obrazovka se po "Rozumím" zavírá - další krok už patří jiné obrazovce,
  // ale tahle má zůstat ztmavená, dokud nezmizí.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!focused) setLeaving(false);
  }, [focused]);

  const showHole = active && focused && !leaving;
  // Bez fokusu ji kryje jiná obrazovka (typicky modální, která právě
  // vyjíždí) - ztmavení necháváme, ať po návratu nic neproblikne. Když se
  // ale uživatel na obrazovku vrátí a krok na ní není, ztmavení zmizí, ať
  // tu nezůstane zablokovaný.
  const dimmed = showHole || leaving || (coaching && !focused);

  const rootRef = useRef<View>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);

  useEffect(() => {
    if (!showHole || !config) return;

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
            prev.shape === config.shape &&
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
  }, [showHole, config, getTarget]);

  const reduceMotion = useReduceMotion();

  // Výřez, jak je právě nakreslený. Při změně kroku přejede ze starého cíle
  // na nový; běžné přeměření (rolování, Reveal) se přebírá rovnou.
  const [drawn, setDrawn] = useState<Hole | null>(null);
  const drawnRef = useRef<Hole | null>(null);
  const drawnStep = useRef(step);
  const glide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hole) return;
    const from = drawnRef.current;
    const stepChanged = drawnStep.current !== step;
    drawnStep.current = step;
    const land = (h: Hole) => {
      drawnRef.current = h;
      setDrawn(h);
    };
    if (!from || !stepChanged || reduceMotion) {
      land(hole);
      return;
    }
    glide.stopAnimation();
    glide.setValue(0);
    const id = glide.addListener(({ value }) => land(lerpHole(from, hole, value)));
    Animated.timing(glide, {
      toValue: 1,
      duration: GLIDE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => land(hole));
    return () => glide.removeListener(id);
  }, [hole]);

  // Celé ztmavení: rozsvícení jen poprvé, zhasnutí vždy plynulé (konec
  // průvodce, otevření listu s ukázkovým přítelem).
  const scrim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    if (dimmed) {
      setRendered(true);
      if (everShown || reduceMotion) {
        scrim.setValue(1);
      } else {
        scrim.setValue(0);
        Animated.timing(scrim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      }
      everShown = true;
      return;
    }
    Animated.timing(scrim, { toValue: 0, duration: reduceMotion ? 120 : 200, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setRendered(false);
      },
    );
  }, [dimmed]);

  // Karta se při každém kroku prolne s novým textem, zatímco výřez přejíždí.
  const card = useRef(new Animated.Value(0)).current;
  const cardReady = showHole && !!hole;
  useEffect(() => {
    if (!cardReady) {
      card.setValue(0);
      return;
    }
    card.setValue(0);
    Animated.timing(card, {
      toValue: 1,
      duration: reduceMotion ? 120 : 180,
      delay: reduceMotion ? 0 : 80,
      useNativeDriver: true,
    }).start();
  }, [cardReady, step]);

  // Jediný ambientní pohyb celého průvodce: pomalé "dýchání" lemu výřezu,
  // které opakuje motiv prstence. Při omezeném pohybu zůstane lem statický.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!cardReady || reduceMotion) {
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
  }, [cardReady, reduceMotion]);

  const cut = showHole ? drawn : null;

  return (
    <View
      ref={rootRef}
      collapsable={false}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {rendered && size && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: scrim }]}
          pointerEvents={dimmed ? 'box-none' : 'none'}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={size.w} height={size.h}>
              <Path d={scrimPath(size, cut)} fill={SCRIM} fillRule="evenodd" />
            </Svg>
          </View>

          <Blockers size={size} box={cut?.box ?? null} />

          {cut && cardReady && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cut.box.x,
                top: cut.box.y,
                width: cut.box.w,
                height: cut.box.h,
                borderRadius: cut.radius,
                borderWidth: 2,
                borderColor: EMBER,
                opacity: reduceMotion ? 0.9 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0] }),
                transform: reduceMotion
                  ? []
                  : [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, cut.shape === 'circle' ? 1.08 : 1.04] }) }],
              }}
            />
          )}

          {cardReady && hole && config && step && (
            <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: card }]}>
              <PlacedCard
                size={size}
                box={hole.box}
                step={step}
                title={config.title}
                body={config.body}
                action={config.action}
                gap={config.cardGap ?? CARD_GAP}
                onAction={() => {
                  if (config.backAfter && router.canGoBack()) {
                    setLeaving(true);
                    router.back();
                  }
                  advance(step);
                }}
                onSkip={skip}
              />
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

/** Kruh i zaoblený obdélník jako jeden tvar (kruh = čtverec s poloměrem w/2), aby šel výřez plynule přelít z jednoho do druhého. */
function scrimPath(size: { w: number; h: number }, hole: Hole | null): string {
  const outer = `M0 0H${size.w}V${size.h}H0Z`;
  if (!hole) return outer;
  const { x, y, w, h } = hole.box;
  const r = Math.min(hole.radius, w / 2, h / 2);
  return (
    `${outer} M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h - r}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}H${x + r}a${r} ${r} 0 0 1 ${-r} ${-r}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  );
}

/** Čtyři pruhy kolem výřezu, které pohltí klepnutí mimo cíl. Bez výřezu blokuje celou plochu. */
function Blockers({ size, box }: { size: { w: number; h: number }; box: Box | null }) {
  const swallow = { onStartShouldSetResponder: () => true };
  if (!box) return <View {...swallow} style={StyleSheet.absoluteFill} />;
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
