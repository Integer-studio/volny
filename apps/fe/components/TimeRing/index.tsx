import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  Platform,
  Text,
  View,
} from "react-native";
import Svg, { Circle, G, Line, Path } from "react-native-svg";
import { formatTime } from "../../lib/time";
import { tickFeedback } from "../../lib/haptics";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import RingMarker from "./RingMarker";
import { Preset } from "./presets";
import {
  SWEEP,
  START_ANGLE,
  T_MAX,
  T_MIN,
  arcPath,
  buildTicks,
  clampOffset,
  dateToOffset,
  normalizeDelta,
  offsetToAngle,
  polar,
  rangeForOffset,
  snapToVisibleTick,
  visibleStep,
} from "./scale";

/**
 * Rozměry jsou navržené pro tuhle šířku a na menších obrazovkách se všechny
 * poměrově zmenší (`k` níž) - jinak by prstenec na úzkém telefonu vylezl
 * z plochy.
 */
export const RING_BASE = 352;

/** Poloměr středu dráhy. Vše ostatní se odvozuje od něj. */
const R = 126;
const TRACK_W = 30;
const HANDLE_R = 22;
/** O kolik handle povyroste, když ho uživatel drží. */
const HANDLE_R_ACTIVE = 26;
/** Čárky leží uvnitř dráhy, symetricky kolem jejího středu. Hodinové se
 * od ostatních liší tloušťkou a mírně délkou, ne barvou. */
const TICK_LEN = { hour: 16, minor: 11 };

/** Kolečko presetu je mezi šířkou dráhy a velikostí handle, aby z prstence
 * vystupovalo, ale nepřebilo knoflík. */
const PRESET_SIZE = 37;
const PRESET_ICON_SIZE = 18;
/** Kam preset uhne, když ho handle dohání. Dál by vylezl z plochy. */
const PRESET_DODGE_PX = 18;
/** Čísla hodin leží zvenčí těsně za dráhou - nechává se jen tolik místa, aby
 * je v klidu nedrhl handle. Když handle přijede, číslo se stejně vytrácí. */
const HOUR_RADIUS = 160;
const HOUR_FONT = 13;
const HOUR_BOX = 18;
/** Podíl průměru prstence, který zabere tlačítko uprostřed. */
export const BUTTON_RATIO = 180 / RING_BASE;

const END_ANGLE = START_ANGLE + SWEEP;
/** Mezikruží, ve kterém prstenec vůbec reaguje na dotek. */
const HIT_INNER = R - 34;
const HIT_OUTER = R + 34;
/** Jak daleko od handle (ve stupních po dráze) ještě začíná tažení. Úhlová
 * tolerance je pro prstenec přirozenější než vzdálenost od středu knoflíku -
 * chytit ho jde i u vnitřní nebo vnější hrany dráhy. Dál od něj je to tap. */
const GRAB_DEG = 26;
/** Jak daleko se dá handle přetlačit za konec dráhy (stupně, asymptota). */
const MAX_OVERSHOOT = 8;

/** Rychlost (°/ms), pod kterou se tažení bere jako "mířím na přesný čas". */
const SPEED_SLOW = 0.03;
/** Rychlost, nad kterou už okno dohání zoom naplno. */
const SPEED_FAST = 0.25;
/** Jak ochotně okno dohání zoom. Roztahuje se rychleji, než se smršťuje -
 * symetrické dohánění se s odečtem hodnoty z okna přetahovalo a čárky pak
 * při couvání poskakovaly dopředu a dozadu. */
const ZOOM_GROW = { base: 0.004, fast: 0.05 };
const ZOOM_SHRINK = { base: 0.0015, fast: 0.015 };
/** Rychlost, pod kterou se doleť vůbec nepočítá. Bez tohohle prahu by i
 * obyčejné rychlejší zadání času po puštění přeskočilo o čárku - tedy o 15
 * minut proti tomu, co měl uživatel před očima. Doletět má jen skutečné
 * "hození" prstencem, ne běžný tah. */
const FLING_MIN_SPEED = 0.12;
/** Jak dlouho dopředu se promítá setrvačnost při "hodu" (ms). */
const FLING_MS = 90;
/** Strop doletu, aby hod přes celý prstenec nekončil vždy na maximu (°). */
const FLING_MAX_DEG = 35;

const TRACK = "#E7E3DC";
const ORANGE = "#EE6C4D";
const BG = "#FCFBF8";
const PRESET_ICON = "#5A5550";
const HOUR_COLOR = "#B3ABA0";

type Props = {
  /** Absolutní čas, do kdy je uživatel volný - konec oranžového oblouku. */
  target: Date;
  /** Teď - začátek oblouku. Jak čas běží, oblouk se sám zkracuje. */
  now: Date;
  /** Vnější rozměr prstence v px. Menší než `RING_BASE` vše poměrově zmenší. */
  size?: number;
  /** Denní kotvy k vykreslení na prstenci. Klepnutím se na ně dá skočit. */
  presets?: Preset[];
  /** Prstenec jen ukazuje, nedá se s ním hýbat. */
  disabled?: boolean;
  /** Průběžná hodnota během tažení. Slouží jen k zobrazení - nesmí se vracet
   * zpátky do `target`, jinak by prop připínal handle na poslední čárku. */
  onPreview?: (target: Date) => void;
  /** Výsledný čas po puštění nebo klepnutí. */
  onChange?: (target: Date) => void;
  /** Obsah uprostřed prstence (hlavní tlačítko). */
  children: React.ReactNode;
};

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/**
 * Úhel bodu vůči středu prstence ve stupních, 0° = 12 hodin, po směru
 * hodinových ručiček - tedy ve stejné soustavě jako `scale.ts`.
 */
function pointToAngle(x: number, y: number, center: number): number {
  const deg = (Math.atan2(x - center, center - y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Úhel, na kterém stojí handle pro daný cílový čas. */
function angleForTarget(target: Date, now: Date): number {
  const offset = clampOffset(dateToOffset(target, now));
  return offsetToAngle(offset, rangeForOffset(offset));
}

/** Minuty od teď, které handle ukazuje - okno je lineární, tak i odečet. */
const readOffset = (angle: number, range: number) =>
  range * clamp((angle - START_ANGLE) / SWEEP, 0, 1);

/**
 * Tlumené přetažení za konec dráhy: první stupně jdou skoro volně, dál se to
 * asymptoticky zadrhává na `MAX_OVERSHOOT`. Handle tak nikdy neuteče do
 * mezery nahoře, ale doraz je cítit jako pružina, ne jako zeď.
 */
const rubber = (over: number) =>
  (MAX_OVERSHOOT * over) / (over + MAX_OVERSHOOT);

function withRubberBand(angle: number): number {
  if (angle > END_ANGLE) return END_ANGLE + rubber(angle - END_ANGLE);
  if (angle < START_ANGLE) return START_ANGLE - rubber(START_ANGLE - angle);
  return angle;
}

/**
 * Prstencový slider kolem hlavního tlačítka - vizuálně kuchyňský časovač.
 *
 * Prstenec je vždy **lineární okno** `[now, now + range]`, takže čárky jsou
 * dokola rovnoměrné. "Zoom" dělá to, že se okno roztahuje - ale ne natvrdo
 * podle hodnoty: během tažení okno hodnotu jen **dohání**, a to tím pomaleji,
 * čím pomaleji uživatel táhne. Pomalý tah (mířím na přesný čas) tedy prstenec
 * prakticky zmrazí, prudký tah ho nechá odzoomovat.
 *
 * Zobrazovaný úhel je vlastní spojitý stav, ne odvozenina z `target`. Během
 * tažení se hlásí jen `onPreview`; `onChange` (a tím i změna propsy) přijde
 * až po puštění - jinak by se prop vracel zpátky a připínal handle na
 * poslední potvrzenou čárku.
 *
 * Gesto jede na `PanResponder` (shodné chování na nativu i na
 * react-native-web) a leží na rodičovském `View`, aby jako předek dostalo
 * dotek vždycky.
 */
export default function TimeRing({
  target,
  now,
  size = RING_BASE,
  presets = [],
  disabled = false,
  onPreview,
  onChange,
  children,
}: Props) {
  const reduceMotion = useReduceMotion();

  // Poměrové zmenšení pro úzké obrazovky. Všechny rozměry se násobí `k`,
  // úhly a časová škála zůstávají nedotčené.
  const k = size / RING_BASE;
  const c = size / 2;
  const r = R * k;

  const initialOffset = clampOffset(dateToOffset(target, now));
  const initialRange = rangeForOffset(initialOffset);

  const angleAnim = useRef(
    new Animated.Value(offsetToAngle(initialOffset, initialRange)),
  ).current;
  const rangeAnim = useRef(new Animated.Value(initialRange)).current;

  const [angle, setAngle] = useState(() =>
    offsetToAngle(initialOffset, initialRange),
  );
  const [range, setRange] = useState(initialRange);
  const [dragging, setDragging] = useState(false);

  // Stejné hodnoty jako stav, ale zapsané synchronně. Gesto se musí rozhodovat
  // podle toho, kam prst právě dojel, ne podle stavu, který se do Reactu
  // dostane až o snímek později.
  const angleRef = useRef(angle);
  const rangeRef = useRef(range);
  /** "idle" = úhel se řídí propsy, jinak si ho drží gesto nebo doběh animace. */
  const mode = useRef<"idle" | "drag" | "settle">("idle");
  // Aby se poznalo, jestli se propsa změnila proto, že hodnotu nastavil někdo
  // zvenčí (klepnutí na preset v seznamu), nebo jen proto, že tikl `now`.
  const lastTarget = useRef(target.getTime());
  const settled = useRef(false);
  // Identifikuje právě běžící doběh. Přerušená animace hlásí `finished: false`
  // a bez tohohle by po ní `mode` zůstal navždy na "settle" - prstenec by pak
  // ignoroval každou další hodnotu nastavenou zvenčí.
  const animRun = useRef(0);

  useEffect(() => {
    const a = angleAnim.addListener(({ value }) => {
      angleRef.current = value;
      setAngle(value);
    });
    const rg = rangeAnim.addListener(({ value }) => {
      rangeRef.current = value;
      setRange(value);
    });
    return () => {
      angleAnim.removeListener(a);
      rangeAnim.removeListener(rg);
    };
  }, [angleAnim, rangeAnim]);

  // Dokud uživatel nezasahuje, je zdrojem pravdy `target`. Přepočítat se to
  // musí i při každém tiknutí `now` - cíl je absolutní čas, takže s ubíhajícím
  // časem se k němu handle sám přibližuje.
  useEffect(() => {
    // Účtování mimo `mode` guard: kdyby se přeskočilo, zůstal by `lastTarget`
    // zastaralý a při nejbližším tiknutí `now` by prstenec doplul znovu.
    const changed = target.getTime() !== lastTarget.current;
    lastTarget.current = target.getTime();
    const first = !settled.current;
    settled.current = true;

    // Jen tažení má hodnotu "ve svých rukou". Během doběhu se naopak musí dát
    // přesměrovat - jinak by klepnutí na preset, které přijde než předchozí
    // doběh dojede, prstenec vůbec nepohnulo (a zůstal by jen popisek).
    if (mode.current === "drag") return;
    const off = clampOffset(dateToOffset(target, now));
    const rng = rangeForOffset(off);

    // Samotný posun `now` je drift o minutu - ten se nastaví natvrdo, jinak
    // by prstenec pružinoval každou minutu. Doplouvá se jen na hodnotu, kterou
    // někdo skutečně nastavil zvenčí (preset ze seznamu, návrat na výchozí čas).
    if (!changed || first) {
      rangeAnim.setValue(rng);
      angleAnim.setValue(offsetToAngle(off, rng));
      return;
    }
    animateTo(off, rng);
  }, [target.getTime(), now.getTime()]);

  const ticks = useMemo(() => buildTicks(now, range), [now.getTime(), range]);

  const latest = useRef({ now, onPreview, onChange });
  latest.current = { now, onPreview, onChange };

  /**
   * Doplutí na danou hodnotu: úhel i okno pružinou současně. Kdyby se hýbal
   * jen úhel, handle by mířil na místo, které se mu pod rukama posune.
   */
  const animateTo = (off: number, rng: number) => {
    const to = offsetToAngle(off, rng);
    if (reduceMotion) {
      rangeAnim.setValue(rng);
      angleAnim.setValue(to);
      mode.current = "idle";
      return;
    }
    const run = ++animRun.current;
    mode.current = "settle";
    const spring = (v: Animated.Value, toValue: number) =>
      Animated.spring(v, {
        toValue,
        stiffness: 170,
        damping: 20,
        mass: 0.9,
        useNativeDriver: false,
      });
    Animated.parallel([spring(angleAnim, to), spring(rangeAnim, rng)]).start(
      () => {
        // Bez ohledu na `finished`: přerušení znamená, že hodnotu přebral někdo
        // jiný, a ten si `mode` nastavil sám. Poznáme to podle `run`.
        if (animRun.current === run) mode.current = "idle";
      },
    );
  };

  /** Doběh po puštění handle nebo po klepnutí - navíc ohlásí hodnotu nahoru. */
  const settleTo = (date: Date) => {
    const off = clampOffset(dateToOffset(date, latest.current.now));
    latest.current.onChange?.(date);
    animateTo(off, rangeForOffset(off));
  };

  const pan = useMemo(() => {
    // Průběžný (rozvinutý) úhel prstu, aby přetažení přes mezeru nahoře
    // pokračovalo dál místo skoku z jednoho konce na druhý.
    let fingerCont = 0;
    let prevRaw = 0;
    let grabOffset = 0;
    let grabbed: "handle" | "track" | null = null;
    let lastTickKey = 0;
    let origin = { x: 0, y: 0 };
    // Vyhlazená úhlová rychlost (°/ms) - řídí jak dolet po hodu, tak to,
    // jak ochotně okno dohání zoom.
    let velocity = 0;
    let prevTime = 0;
    let edgeLoop: number | null = null;

    const local = (pageX: number, pageY: number) => ({
      x: pageX - origin.x,
      y: pageY - origin.y,
    });

    const inBand = (e: GestureResponderEvent) => {
      if (disabled) return false;
      const { locationX, locationY } = e.nativeEvent;
      const d = Math.hypot(locationX - c, locationY - c);
      return d >= HIT_INNER * k && d <= HIT_OUTER * k;
    };

    const snapAt = (a: number, rng: number) =>
      snapToVisibleTick(readOffset(a, rng), rng, latest.current.now);

    /** Ohlásí nahoru novou náhledovou hodnotu, ale jen když se opravdu změnila. */
    const preview = (a: number, rng: number) => {
      const snapped = snapAt(a, rng);
      if (snapped.getTime() === lastTickKey) return;
      lastTickKey = snapped.getTime();
      tickFeedback();
      latest.current.onPreview?.(snapped);
    };

    /** Posun okna o jeden krok směrem k tomu, co hodnota potřebuje. */
    const easeRange = (desired: number, rate: number) => {
      const wanted = rangeForOffset(readOffset(desired, rangeRef.current));
      const next = rangeRef.current + (wanted - rangeRef.current) * rate;
      rangeRef.current = next;
      rangeAnim.setValue(next);
      return next;
    };

    /**
     * Když prst zůstane přitlačený za koncem dráhy, okno se samo roztahuje -
     * jinak by se na maximum dalo dojet jen tak, že uživatel táhne daleko mimo
     * prstenec i mimo obrazovku. Běží na vlastní smyčce, aby to fungovalo
     * i když prst stojí a žádné `move` události nechodí.
     */
    const runEdge = () => {
      edgeLoop = requestAnimationFrame(runEdge);
      const desired = fingerCont - grabOffset;
      const over = desired - END_ANGLE;
      if (over <= 0) return;
      const nextRange = easeRange(desired, clamp(over / 30, 0, 1) * 0.06);
      preview(withRubberBand(desired), nextRange);
    };

    const stopEdge = () => {
      if (edgeLoop !== null) cancelAnimationFrame(edgeLoop);
      edgeLoop = null;
    };

    return PanResponder.create({
      // Pozor: NEpřidávat `...Capture` varianty. Když se dotek zabere už
      // v capture fázi, `onPanResponderMove` na webu nedorazí - handle
      // povyroste, ale s prstem se nehne.
      onStartShouldSetPanResponder: inBand,
      onMoveShouldSetPanResponder: inBand,
      // Tažení za handle si držíme za každou cenu, jinak ho ScrollView po pár
      // pixelech sebere a změní ve scroll. Dotek jinde na dráze klidně pustíme.
      onPanResponderTerminationRequest: () => grabbed !== "handle",

      onPanResponderGrant: (e) => {
        const { pageX, pageY, locationX, locationY } = e.nativeEvent;
        origin = { x: pageX - locationX, y: pageY - locationY };
        // Doběh předchozí pružiny by se s `setValue` přetahoval a tažení by
        // vypadalo, že se handle musí "odlepit".
        angleAnim.stopAnimation();
        rangeAnim.stopAnimation();
        // Doběh, který jsme právě zastavili, si nesmí po svém callbacku
        // přepsat `mode` zpátky na "idle" uprostřed tažení.
        animRun.current++;

        const cur = angleRef.current;
        const touchAngle = pointToAngle(locationX, locationY, c);
        grabbed =
          Math.abs(normalizeDelta(touchAngle - cur)) <= GRAB_DEG
            ? "handle"
            : "track";
        if (grabbed !== "handle") return;

        prevRaw = touchAngle;
        fingerCont = touchAngle;
        grabOffset = normalizeDelta(touchAngle - cur);
        velocity = 0;
        prevTime = Date.now();
        lastTickKey = snapAt(cur, rangeRef.current).getTime();
        mode.current = "drag";
        setDragging(true);
        runEdge();
      },

      onPanResponderMove: (e, g) => {
        if (grabbed !== "handle") return;
        // Obě cesty k souřadnicím se liší podle platformy i typu vstupu, tak
        // se berou obě - `??` by tu nestačilo, protože nulu propustí dál.
        const ev = e.nativeEvent;
        const p = local(g.moveX || ev.pageX || 0, g.moveY || ev.pageY || 0);
        const raw = pointToAngle(p.x, p.y, c);
        const step = normalizeDelta(raw - prevRaw);
        fingerCont += step;
        prevRaw = raw;

        const t = Date.now();
        const dt = Math.max(1, t - prevTime);
        prevTime = t;
        // Exponenciální průměr - jednotlivé události jsou příliš zubaté na to,
        // aby se z nich dal brát dolet přímo.
        velocity = velocity * 0.7 + (step / dt) * 0.3;

        const desired = fingerCont - grabOffset;
        const next = withRubberBand(desired);
        angleRef.current = next;
        angleAnim.setValue(next);

        // Okno hodnotu jen dohání, a to podle rychlosti tahu: při pomalém
        // míření je zoom prakticky zmrazený, takže se čárky nehýbou pod
        // prstem; při prudkém tahu dojede skoro okamžitě.
        const follow = clamp(
          (Math.abs(velocity) - SPEED_SLOW) / (SPEED_FAST - SPEED_SLOW),
          0,
          1,
        );
        const kz =
          rangeForOffset(readOffset(next, rangeRef.current)) > rangeRef.current
            ? ZOOM_GROW
            : ZOOM_SHRINK;
        const nextRange = easeRange(next, kz.base + kz.fast * follow);

        preview(next, nextRange);
      },

      onPanResponderRelease: (_e, g) => {
        stopEdge();
        if (grabbed === "handle") {
          setDragging(false);
          // Setrvačnost: doletí jen skutečný hod. Rychlost se nejdřív sníží
          // o mrtvou zónu, takže běžný (i svižný) tah skončí přesně tam, kde
          // ho uživatel pustil, a nepřeskočí mu čas o čárku.
          const excess = Math.max(0, Math.abs(velocity) - FLING_MIN_SPEED);
          const fling = clamp(
            Math.sign(velocity) * excess * FLING_MS,
            -FLING_MAX_DEG,
            FLING_MAX_DEG,
          );
          const projected = clamp(
            angleRef.current + fling,
            START_ANGLE,
            END_ANGLE,
          );
          settleTo(snapAt(projected, rangeRef.current));
        } else if (Math.hypot(g.dx, g.dy) < 10) {
          // Klepnutí na dráhu mimo handle: doplout tam. Táhnutí odsud
          // schválně nic nedělá - hodnotu mění jen handle.
          const p = local(g.moveX || g.x0, g.moveY || g.y0);
          const a = clamp(pointToAngle(p.x, p.y, c), START_ANGLE, END_ANGLE);
          tickFeedback();
          settleTo(snapAt(a, rangeRef.current));
        }
        grabbed = null;
      },

      onPanResponderTerminate: () => {
        stopEdge();
        if (grabbed === "handle") {
          setDragging(false);
          settleTo(snapAt(angleRef.current, rangeRef.current));
        }
        grabbed = null;
      },
    });
  }, [angleAnim, rangeAnim, c, k, reduceMotion, disabled]);

  /**
   * Posun hodnoty o jeden viditelný krok - pro čtečky obrazovky, které umí
   * jen "zvýšit / snížit". Krok kopíruje to, co je v daném zoomu vidět,
   * takže se chová stejně jako snap při tažení.
   */
  const nudge = (dir: 1 | -1) => {
    const step = visibleStep(range) * dir;
    const next = new Date(target.getTime() + step * 60_000);
    const off = dateToOffset(next, now);
    if (off < T_MIN || off > T_MAX) return;
    onChange?.(next);
  };

  const handleR = (dragging ? HANDLE_R_ACTIVE : HANDLE_R) * k;
  const handle = polar(c, c, r, angle);
  const shownOffset = readOffset(angle, range);

  const hourTicks = ticks.filter((t) => t.isHour);

  return (
    <View
      style={[
        { width: size, height: size },
        // `userSelect` - bez toho tažení po prstenci na webu označuje text
        // pod kurzorem a nechává za sebou modrý výběr.
        Platform.OS === "web"
          ? ({
              userSelect: "none",
              cursor: disabled ? "default" : dragging ? "grabbing" : "pointer",
            } as object)
          : null,
      ]}
      className="items-center justify-center"
      {...pan.panHandlers}
    >
      {/* Prstenec samotný je pro čtečky "adjustable": ohlásí aktuální čas a
          umí ho posunout o krok. Role sedí na obalu kresby, ne na kontejneru
          s gestem - ten je předkem tlačítka i presetů, a označit ho jako
          přístupný prvek by je z pohledu čtečky spolklo. Kreslení nebere
          dotyky, takže tady role nikomu nepřekáží.
          Klávesnice na webu tímhle pokrytá není - RNW pro roli slider sama
          šipky neobsluhuje a vlastní `onKeyDown` v jejím API není. */}
      <View
        style={{ position: "absolute", width: size, height: size }}
        pointerEvents="none"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Volný do"
        accessibilityValue={{ text: formatTime(target) }}
        accessibilityActions={[
          { name: "increment" },
          { name: "decrement" },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment") nudge(1);
          if (e.nativeEvent.actionName === "decrement") nudge(-1);
        }}
      >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute" }}
        pointerEvents="none"
      >
        <Path
          d={arcPath(c, c, r, START_ANGLE, END_ANGLE)}
          stroke={TRACK}
          strokeWidth={TRACK_W * k}
          strokeLinecap="round"
          fill="none"
        />

        <Path
          d={arcPath(c, c, r, START_ANGLE, angle)}
          stroke={ORANGE}
          strokeWidth={TRACK_W * k}
          strokeLinecap="round"
          fill="none"
        />

        {/* Čárky na nataženém (oranžovém) úseku jsou světlé, na volné dráze
            tmavé - jinak by na oranžové zanikly. Hodinové se liší jen
            tloušťkou a délkou, barva je všude stejná. */}
        <G>
          {ticks.map((t) => {
            const len = (t.isHour ? TICK_LEN.hour : TICK_LEN.minor) * k;
            const a = polar(c, c, r + len / 2, t.angle);
            const b = polar(c, c, r - len / 2, t.angle);
            const onArc = t.angle <= angle;
            return (
              <Line
                key={t.date.getTime()}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={onArc ? "#FFF" : "#000"}
                strokeOpacity={(onArc ? 0.32 : 0.13) * t.opacity}
                strokeWidth={(t.isHour ? 2.5 : 1.4) * k}
                strokeLinecap="round"
              />
            );
          })}
        </G>

        {/* Handle: světlý knoflík s oranžovým lemem a tečkou uprostřed - čte
            se jako fyzický ovladač, ne jako useknutý konec čáry. */}
        <Circle
          cx={handle.x}
          cy={handle.y}
          r={handleR}
          fill={BG}
          stroke={ORANGE}
          strokeWidth={3.5 * k}
        />
        <Circle
          cx={handle.x}
          cy={handle.y}
          r={(dragging ? 7 : 6) * k}
          fill={ORANGE}
        />
      </Svg>
      </View>

      {/* Čísla hodin zvenčí za dráhou. Handle je nemá čím překrýt, takže
          nikam neuhýbají ani se neschovávají. */}
      {hourTicks.map((t) => (
        <RingMarker
          key={t.date.getTime()}
          angle={t.angle}
          handleAngle={angle}
          center={c}
          radius={HOUR_RADIUS * k}
          size={HOUR_BOX * k}
          avoid="none"
        >
          <Text
            style={{
              fontSize: HOUR_FONT * k,
              color: HOUR_COLOR,
              fontVariant: ["tabular-nums"],
            }}
          >
            {String(t.date.getHours()).padStart(2, "0")}
          </Text>
        </RingMarker>
      ))}

      {/* Ikonky presetů leží nad SVG jako běžné View, ne jako `SvgText`:
          emoji ani lucide se v SVG na nativu nevykreslí spolehlivě a
          `Pressable` tady navíc dostane svoje klepnutí sám, bez zasahování
          do gesta prstence. */}
      {presets.map((p) => {
        const off = dateToOffset(p.date, now);
        // Mimo aktuální okno kolečko nakreslit nejde. V seznamu pod prstencem
        // je preset dostupný vždycky, takže se tím o nic nepřichází.
        if (off <= 0 || off > range) return null;
        return (
          <RingMarker
            key={p.id}
            angle={offsetToAngle(off, range)}
            handleAngle={angle}
            center={c}
            radius={r}
            size={PRESET_SIZE * k}
            avoid="dodge"
            dodgePx={PRESET_DODGE_PX * k}
            onPress={() => settleTo(p.date)}
            accessibilityLabel={`Volný do ${p.label.toLowerCase()}`}
          >
            <View
              style={{
                width: PRESET_SIZE * k,
                height: PRESET_SIZE * k,
                borderRadius: (PRESET_SIZE * k) / 2,
                backgroundColor: "#FFF",
                alignItems: "center",
                justifyContent: "center",
                // Stín místo lemu - kolečko se má nad prstencem vznášet, ne
                // se do něj obtahovat. Obojí (iOS shadow* i Android
                // elevation), protože každá platforma poslouchá jen svoje.
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <p.Icon
                size={PRESET_ICON_SIZE * k}
                color={PRESET_ICON}
                strokeWidth={2}
              />
            </View>
          </RingMarker>
        );
      })}

      {children}
    </View>
  );
}
