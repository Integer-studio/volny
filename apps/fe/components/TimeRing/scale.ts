/**
 * Škála prstence pro zadávání času.
 *
 * Zadává se **absolutní čas** ("volný do 15:00"), ne délka. Čárky sedí na
 * celých čtvrthodinách nástěnných hodin, takže handle vždy ukazuje na
 * skutečný čas.
 *
 * Prstenec je vždy **lineární okno** `[now, now + range]`. To je důvod, proč
 * jsou čárky v každém okamžiku rozmístěné naprosto rovnoměrně - kruh vypadá
 * konzistentně dokola, ne hustě vlevo a řídce vpravo.
 *
 * "Zoom" nedělá zakřivená škála, ale to, že `range` roste s hodnotou: dokud
 * je handle v klidné zóně (do 2/3 oblouku, tj. do 4 h), okno se nehýbe;
 * jakmile ho uživatel přetáhne dál, okno se plynule roztahuje, všechny čárky
 * se rovnoměrně stahují k sobě a 15minutové se postupně vytratí (`tickOpacity`).
 * Handle přitom končí těsně před koncem dráhy, takže je pořád vidět, kam ještě lze.
 *
 * Mapování je monotónní a v uzavřeném tvaru i zpětně, takže tažení je v celém
 * rozsahu stabilní - handle sedí přesně pod prstem, i když se okno pod ním mění.
 */

/**
 * Nejkratší volno, na které se dá **dotáhnout** prstenec. Neplatí pro
 * hodnotu nastavenou klepnutím na preset - denní kotva může být klidně pár
 * minut před sebou a je legitimní ji zvolit; handle pak sedne až na samý
 * začátek dráhy, před tuhle mez.
 */
export const T_MIN = 15;
/**
 * Nejvzdálenější zadatelný čas: 24 hodin od teď. Rozsah je právě takový,
 * aby **každá** denní kotva byla vždy dosažitelná - nejbližší budoucí výskyt
 * hodiny nikdy neleží dál než den. Kdyby byl rozsah menší, seznam presetů by
 * nabízel časy, na které prstenec neumí ukázat.
 */
export const T_MAX = 1440;
/** Krok snapu v minutách - vždy se trefuje celá čtvrthodina. */
export const STEP = 15;

/** Úhel začátku dráhy ve stupních; 0° = 12 hodin, roste po směru hodinových ručiček. */
export const START_ANGLE = 15;
/** Délka dráhy ve stupních. Zbylých 30° je mezera nahoře. */
export const SWEEP = 330;

/** Okno prstence, dokud je handle v klidné zóně (6 h). */
const RANGE_MIN = 360;
/** Podíl oblouku, za kterým se okno začne roztahovat. */
const P_MIN = 2 / 3;
/** Podíl oblouku, na kterém handle skončí na maximu. */
const P_MAX = 0.97;
/** Hodnota, na které zoom začíná (konec klidné zóny). */
const V0 = RANGE_MIN * P_MIN;

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/** Ořez pro vykreslení. Dolní mez je nula, ne `T_MIN` - hodnota z presetu
 * může ležet blíž a handle ji má ukázat tam, kde skutečně je. */
export const clampOffset = (min: number): number => clamp(min, 0, T_MAX);

/** Podíl oblouku (0..1), na kterém stojí handle pro danou hodnotu. */
function offsetToFrac(offsetMin: number): number {
  const v = clamp(offsetMin, 0, T_MAX);
  if (v <= V0) return v / RANGE_MIN;
  return P_MIN + ((P_MAX - P_MIN) * (v - V0)) / (T_MAX - V0);
}

/** Inverze `offsetToFrac`: podíl oblouku → minuty od teď. */
function fracToOffset(frac: number): number {
  const q = clamp(frac, 0, 1);
  if (q <= P_MIN) return q * RANGE_MIN;
  if (q >= P_MAX) return T_MAX;
  return V0 + ((q - P_MIN) / (P_MAX - P_MIN)) * (T_MAX - V0);
}

/**
 * Šířka okna prstence v minutách pro danou hodnotu. Odvozuje se z `frac` tak,
 * aby okno bylo přesně to lineární měřítko, ve kterém handle vyjde na svůj
 * podíl oblouku - proto je vykreslení čárek i handle konzistentní.
 */
export function rangeForOffset(offsetMin: number): number {
  const v = clamp(offsetMin, 0, T_MAX);
  if (v <= V0) return RANGE_MIN;
  return v / offsetToFrac(v);
}

/** Minuty od teď → úhel ve stupních, v okně `range`. */
export const offsetToAngle = (offsetMin: number, range: number): number =>
  START_ANGLE + clamp(offsetMin / range, 0, 1) * SWEEP;

/** Úhel ve stupních → minuty od teď. Bere v potaz i zoom, proto ne přes `range`. */
export const angleToOffset = (angle: number): number =>
  fracToOffset((angle - START_ANGLE) / SWEEP);

/** Nejbližší celá čtvrthodina nástěnných hodin (:00/:15/:30/:45). */
export function snapToQuarter(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(Math.round(d.getMinutes() / STEP) * STEP);
  return d;
}

/** Absolutní čas odpovídající `offsetMin` minutám od `now`, snapnutý na čtvrthodinu. */
export const offsetToDate = (offsetMin: number, now: Date): Date =>
  snapToQuarter(new Date(now.getTime() + offsetMin * 60_000));

/** Minuty od `now` do `date` (může být i záporné). */
export const dateToOffset = (date: Date, now: Date): number =>
  (date.getTime() - now.getTime()) / 60_000;

/**
 * Ořízne cílový čas do zadatelného rozsahu a drží ho na čtvrthodině. Dolní
 * mez je `now`, ne `T_MIN`: čas pár minut před sebou je legitimní (kotva
 * "Půlnoc" ve 23:52), jen na něj nejde dotáhnout prstenec.
 */
export function clampTarget(date: Date, now: Date): Date {
  const max = new Date(now.getTime() + T_MAX * 60_000);
  if (date > max) {
    const d = new Date(max);
    d.setSeconds(0, 0);
    d.setMinutes(Math.floor(d.getMinutes() / STEP) * STEP);
    return d;
  }
  const d = snapToQuarter(date);
  // Zaokrouhlení na čtvrthodinu může čas posunout dozadu - do minulosti se
  // ale nesmí dostat, jinak by volno skončilo dřív, než začalo.
  while (d.getTime() <= now.getTime()) d.setMinutes(d.getMinutes() + STEP);
  return d;
}

export type Tick = {
  /** Absolutní čas, na kterém čárka stojí. */
  date: Date;
  angle: number;
  /** Celá hodina se kreslí výrazněji; 15 a 30 min vypadají stejně. */
  isHour: boolean;
  /** 0..1 - hustší čárky se s roztahujícím se oknem plynule vytrácejí. */
  opacity: number;
};

/** Plná viditelnost čárek při tomhle rozestupu (stupně) a víc. */
const FADE_FULL_DEG = 12;
/** Úplně neviditelné při tomhle rozestupu a míň. */
const FADE_GONE_DEG = 8;

/** Viditelnost třídy čárek podle toho, jak daleko od sebe v okně vycházejí. */
const opacityForStep = (stepMin: number, range: number) =>
  clamp(
    ((SWEEP * stepMin) / range - FADE_GONE_DEG) / (FADE_FULL_DEG - FADE_GONE_DEG),
    0,
    1,
  );

/**
 * Čárky na celých čtvrthodinách nástěnných hodin uvnitř okna `[now, now+range]`.
 * Rozestupy jsou z definice rovnoměrné (okno je lineární); s rostoucím oknem
 * se všechny stejně stahují a ty hustší se plynule vytrácejí - nejdřív
 * čtvrthodinové, u úplně roztaženého okna i půlhodinové. Granularita se tak
 * zhrubne bez skoku a bez přepínání "zoom levelu".
 *
 * Čárky blíž než `T_MIN` se vynechávají - nemá smysl nabízet cíl, na který
 * se stejně nedá nastavit.
 */
export function buildTicks(now: Date, range: number): Tick[] {
  const quarterOpacity = opacityForStep(STEP, range);
  const halfOpacity = opacityForStep(30, range);

  const first = new Date(now);
  first.setSeconds(0, 0);
  first.setMinutes(Math.ceil(first.getMinutes() / STEP) * STEP);

  const ticks: Tick[] = [];
  for (let t = first.getTime(); ; t += STEP * 60_000) {
    const offset = (t - now.getTime()) / 60_000;
    if (offset > range) break;
    if (offset < T_MIN) continue;
    const date = new Date(t);
    const min = date.getMinutes();
    const opacity =
      min === 0 ? 1 : min % 30 !== 0 ? quarterOpacity : halfOpacity;
    if (opacity === 0) continue;
    ticks.push({
      date,
      angle: offsetToAngle(offset, range),
      isHour: min === 0,
      opacity,
    });
  }
  return ticks;
}

/** Nejjemnější krok čárek, který je v daném okně ještě vidět (minuty). */
export function visibleStep(range: number): number {
  if (opacityForStep(STEP, range) > 0) return STEP;
  if (opacityForStep(30, range) > 0) return 30;
  return 60;
}

/**
 * Zaklapne minuty od teď na nejbližší čárku, která je v daném okně vidět.
 * Počítá se přímo z okna, ne z vykresleného pole čárek - to během tažení
 * zaostává o snímek a handle by pak dosedal vedle.
 */
export function snapToVisibleTick(
  offsetMin: number,
  range: number,
  now: Date,
): Date {
  const step = visibleStep(range);
  const d = new Date(now.getTime() + clamp(offsetMin, 0, T_MAX) * 60_000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.round(d.getMinutes() / step) * step);
  // Zaokrouhlení může vypadnout z povoleného rozsahu - posune se o krok zpět.
  while (dateToOffset(d, now) < T_MIN) d.setMinutes(d.getMinutes() + step);
  while (dateToOffset(d, now) > T_MAX) d.setMinutes(d.getMinutes() - step);
  return d;
}

/** Rozdíl dvou úhlů převedený do (-180, 180] - základ pro rozvinutí otáčení. */
export const normalizeDelta = (deg: number) =>
  ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Bod na kružnici o poloměru `r` se středem v `[cx, cy]`.
 * 0° míří nahoru (12 hodin), kladné úhly jdou po směru hodinových ručiček —
 * v SVG souřadnicích (y roste dolů) to znamená sin/-cos.
 */
export function polar(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/**
 * SVG `d` pro oblouk od `fromDeg` do `toDeg` po směru hodinových ručiček.
 * Prázdný řetězec pro nulovou/zápornou délku - `<Path d="">` nic nevykreslí,
 * což je přesně to, co chceme u nulového oblouku (jinak by `strokeLinecap`
 * vykreslil osamocenou tečku).
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number,
): string {
  if (toDeg - fromDeg <= 0.01) return "";
  const start = polar(cx, cy, r, fromDeg);
  const end = polar(cx, cy, r, toDeg);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
