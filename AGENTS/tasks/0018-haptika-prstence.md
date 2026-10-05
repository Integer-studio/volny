# 0018 — Haptika prstencového zadávání času

- **Stav:** done
- **Priorita:** 2 (důležité, ale nebrání releasu)
- **Datum vytvoření:** 2026-09-09

## Popis / kontext

Prstencové zadávání času z [0007](./0007-nove-zadavani-casu.md) mělo hmatovou
odezvu slabou a rozmazanou — na Pixelu 8 „nic moc“. Cílem jsou **krátké, ale
relativně silné údery**, které se liší podle toho, přes jakou čárku handle
přejíždí, aby prst poznal hierarchii stejně, jako ji oko vidí na čárkách.

**Zjištěné příčiny (2026-09-09):**

1. **Android šel cestou, kterou `expo-haptics` sám nedoporučuje.**
   `tickFeedback()` volalo `selectionAsync()`; podle dokumentace té knihovny
   jsou `impactAsync`/`selectionAsync` na Androidu jen **simulované přes
   `Vibrator`** a doporučuje se `performAndroidHapticsAsync`. Vedlejší, ale
   podstatný rozdíl: simulace obchází systémový přepínač hmatové odezvy.
2. **Žádné omezení frekvence.** Odezva se pouštěla při každé změně čárky, a to
   i z `requestAnimationFrame` smyčky (`runEdge`), takže při rychlém tahu šly
   desítky událostí za sekundu. Ty se na motoru fyzicky **slévají v jeden
   delší a tupější pulz** — netlumený proud tedy paradoxně oslaboval to, co
   mělo být cítit. Silnější preset by to sám nespravil.
3. **Všechna cvaknutí byla stejná**, takže z odezvy nešlo nic vyčíst.

## Kritéria splnění

- [x] Android jde přes `performAndroidHapticsAsync` (respektuje systémové
      nastavení hmatové odezvy).
- [x] Síla se liší podle třídy čárky (hodina / půlhodina / čtvrthodina).
- [x] Při prudkém tahu se jemnější třídy tlumí, aby proud nesplýval —
      nad prahem cvakají jen hodiny.
- [x] Omezení frekvence včetně zvláštního, přísnějšího režimu pro namotávání
      za koncem dráhy (rAF smyčka) a stropu na jedno držení.
- [x] Odezva navíc na: potvrzení volna, ukončení volna, doraz na kraji
      rozsahu (hranově, s hysterezí), dosednutí/přejezd denní kotvy.
- [x] Fallback pro starší Android — část konstant existuje až od API 30/34.
- [x] Doladit tabulku mapování na Pixelu 8 — výchozí hodnoty uživatel
      2026-10-05 potvrdil jako v pořádku, beze změny.
- [x] Odstranit dev seznam `components/HapticLab.tsx` i jeho použití
      v `app/settings.tsx`.
- [x] Odezva i ve webovém prohlížeči — `expo-haptics` na webu nedělá nic,
      proto `lib/haptics.ts` na webu volá `navigator.vibrate` (pole `web`
      v tabulce; Vibration API nemá sílu, hierarchii nese délka pulzu).
      Funguje jen v Chromiu/Firefoxu na Androidu — **Safari (iOS i macOS)
      Vibration API neimplementuje**, desktop nemá motor. Ověřeno v Chromu
      na Androidu (2026-10-05). Pozor při testování: Chrome vibruje až po
      prvním klepnutí na stránku a telefon může vibraci z prohlížeče
      blokovat (úspora baterie, Nerušit, vypnuté vibrace), i když nativní
      haptika v appce jde.

## Poznámky

Implementace je čistě v JS, takže jde **OTA přes EAS Update** — žádný nový
store build. To bylo záměrné rozhodnutí: `runtimeVersion.policy` je
`appVersion`, takže cokoli nativního by znamenalo bump verze a nový build.

**Reduce motion se schválně nehlídá.** Je to preference o *vizuálním* pohybu
(nevolnost z animací), ne o hmatové odezvě — pro někoho je haptika naopak to,
co animaci nahrazuje. Android má navíc vlastní přepínač hmatové odezvy, který
nová cesta respektuje sama.

**Plynule řízená síla (`intensity`/`sharpness`) v `expo-haptics` neexistuje** —
ověřeno ve verzi 57.0.2, exportuje jen `impactAsync`, `notificationAsync`,
`selectionAsync` a `performAndroidHapticsAsync`, žádný parametr intenzity.
Kdyby presety nestačily, další fáze je vlastní Expo modul: na iOS Core Haptics
(`CHHapticEvent` s intenzitou a ostrostí 0..1), na Androidu 12+
`VibrationEffect.startComposition().addPrimitive(...)` se škálou 0..1. Sémantické
API v `lib/haptics.ts` je pro to připravené švy — měnila by se jen tabulka
mapování, žádné volající místo. Cena: Swift + Kotlin, konec doručování OTA
(nový build a bump verze) a jde to proti uzavřenému tasku
[0003](./0003-velikost-apk.md) (velikost APK).
