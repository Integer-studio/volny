# 0013 — Lubomír mode on/off (vypnutý stav bez obrázků Lubomíra Volného)

- **Stav:** done
- **Priorita:** 1 (musí být hotové před veřejným releasem — právní riziko používání podobizny reálné osoby bez svolení, viz Poznámky)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

`volny.png` a podobné assety v appce používají obrázek politika Lubomíra
Volného. V nastavení má být možnost tyto obrázky vypnout a nahradit je
generickými ikonkami ("Lubomír mode" on/off).

**Zjištěný current stav (2026-09-06):** Jediný obrazový soubor s
podobiznou je `apps/fe/assets/images/volny.png`, použitý na 5 místech:
hlavní kruhové tlačítko appky (`components/FreeButton.tsx`), ikona push
notifikace na webu (`public/firebase-messaging-sw.js`), a navíc app icon
pro iOS/Android a web favicon (`app.json` → `expo.icon`,
`android.adaptiveIcon.foregroundImage`, `web.favicon`) — ty poslední dva
jsou ale statické build-time assety, runtime toggle je bez rebuildu
nezmění.

**Rozhodnuto (rozsah a výchozí stav), aktualizováno 2026-10-05:** toggle
ovlivní runtime použití, tedy hlavní tlačítko appky a ikonu push notifikace
na webu. **Výchozí stav je vypnuto (opt-in)**: fotka se zobrazí jen tomu, kdo
si ji v nastavení sám zapne. Tím se mění původní opt-out kvůli právnímu
kontextu níže. Statické webové ikony (PWA ikony z manifestu,
`apple-touch-icon`, favicon) se natrvalo nahradily generickými. Na webu stačí
redeploy, není potřeba store submission. Mobilní app icon (`expo.icon`,
`android.adaptiveIcon`) zůstává beze změny.

## Kritéria splnění

- [x] Nastavení (`apps/fe/app/settings.tsx`) obsahuje toggle "Lubomír
      mode" (výchozí stav: **vypnuto**).
- [x] Když je vypnuto: hlavní kruhové tlačítko (`components/FreeButton.tsx`)
      zobrazuje generickou ikonku (Lucide `party-popper`) místo
      `assets/images/volny.png`.
- [x] Když je vypnuto: ikona push notifikace na webu
      (`apps/fe/public/firebase-messaging-sw.js` i foreground notifikace v
      `lib/push.ts`) je generická.
- [x] PWA ikony (`public/icons/*`) a web favicon (`assets/images/favicon.png`)
      jsou generické. Mobilní app icon zůstává beze změny, protože by vyžadoval
      rebuild a app store submission.
- [x] Preference se ukládá lokálně na zařízení (přes
      `apps/fe/lib/storage.ts`, logika v `lib/lubomir-mode.tsx`). Sdílení mezi
      zařízeními by vyžadovalo BE endpoint (mimo rozsah).

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).

**Právní kontext (proč priorita 1):** použití podobizny reálné osoby
(politika Lubomíra Volného) bez jejího svolení je zásah do osobnostních
práv (§ 84–85 obč. zákoníku) — "je to jen vtip" ho automaticky nekryje,
protože jde o dekorativní/humorné použití mimo kontext jeho veřejné
politické činnosti, ne o chráněnou satiru/zpravodajství. Dotčená osoba by
mohla požadovat odstranění i nemajetkovou náhradu. Toggle on/off riziko
snižuje, ale pokud je obrázek zapnutý defaultně, appka ho aktivně používá
bez souhlasu všem, kdo si ho sami nevypnou — zvážit opt-in (vypnuto
defaultně) místo opt-out.

**Implementace (2026-10-05):** service worker nemá přístup k `localStorage`,
proto stránka zrcadlí preferenci do Cache Storage (`volny-prefs` →
`/__prefs/lubomir-mode`) a SW si ji při zobrazení notifikace přečte. Co není
explicitně `on`, znamená generickou ikonu. Původní cesta ikony v SW
(`/assets/images/volny.png`) byla rozbitá ještě před tímto taskem: Expo export
asset hashuje (`assets/assets/images/volny.<hash>.png`). Ikony notifikací teď
leží s pevnou cestou v `public/icons/notification-{generic,lubomir}.png`.
