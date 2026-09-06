# 0013 — Lubomír mode on/off (vypnutý stav bez obrázků Lubomíra Volného)

- **Stav:** todo
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

**Rozhodnuto (rozsah a výchozí stav):** toggle ovlivní jen runtime
použití — hlavní tlačítko appky a ikonu push notifikace na webu. App icon
a favicon zůstávají mimo rozsah (beze změny). **Výchozí stav je zapnuto**
(opt-out) — viz právní kontext níže, toto je vědomě přijaté riziko, ne
opomenutí.

## Kritéria splnění

- [ ] Nastavení (`apps/fe/app/settings.tsx`) obsahuje toggle "Lubomír
      mode" (výchozí stav: zapnuto).
- [ ] Když je vypnuto: hlavní kruhové tlačítko (`components/FreeButton.tsx`)
      zobrazuje generickou ikonku místo `assets/images/volny.png`.
- [ ] Když je vypnuto: ikona push notifikace na webu
      (`apps/fe/public/firebase-messaging-sw.js`) je generická.
- [ ] Mimo rozsah: app icon (iOS/Android) a web favicon (`app.json`)
      zůstávají beze změny — vyžadovaly by rebuild/app store submission.
- [ ] Preference se ukládá lokálně na zařízení (přes
      `apps/fe/lib/storage.ts`) — zatím neexistuje BE endpoint pro
      per-user preference; pokud má být sdílená mezi zařízeními, je
      potřeba i BE rozšíření (mimo rozsah tohoto tasku, pokud nebude
      řečeno jinak).

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
