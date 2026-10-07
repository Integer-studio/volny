# 0022 — Pozvánka do skupiny jako sheet s přijmout/odmítnout a sdílením

- **Stav:** done
- **Priorita:** 2 (důležité, ale nebrání releasu)
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

Po otevření odkazu na skupinu se dřív buď ukázala celá stránka
`/join/[code]` s tlačítkem „Připojit se“ (přihlášený), nebo se uživatel po
přihlášení/registraci připojil automaticky (`PendingInviteGate`). Nově se
zobrazí spodní sheet s přijetím/odmítnutím a rovnou s přepínačem sdílení
volna a kontaktu se skupinou z [0021](./0021-skupina-toggle-volno-a-kontakt.md).

## Rozhodnutí (2026-10-07, se zadavatelem)

- Přihlášený uživatel: `/join/[code]` uloží kód a přesměruje na hlavní
  obrazovku, sheet vyjede nad ní. Po přijetí i odmítnutí zůstává doma.
- Nepřihlášený: stávající stránka s výzvou k přihlášení zůstává, po
  přihlášení/registraci se místo automatického připojení ukáže sheet.
- Nově registrovaný: sheet až po části A průvodce (intro, kontakt,
  instalace), před nápovědami nad hlavní obrazovkou.
- Přepínač sdílení výchozí zapnuto.
- Zavření sheetu jinak (tap mimo, Zpět na Androidu) = odmítnutí, kód se
  zahodí.
- Obsah: ikona skupiny, název, přepínač s vysvětlením, Odmítnout / Přijmout.

## Kritéria splnění

- [x] `POST /api/groups/join` přijímá `sharesWithGroup` (výchozí `true`,
      u existujícího člena se ignoruje).
- [x] `PendingInviteGate` ukazuje sheet místo automatického připojení,
      čeká na konec části A průvodce, už-člen → toast, neplatný kód → toast.
- [x] `/join/[code]` pro přihlášené jen uloží kód a jde domů
      (`onPendingInviteSet` probudí gate).
- [x] Text vysvětlení sdílený s detailem skupiny (`lib/group-sharing.ts`).
- [x] Ověřeno ve webovém buildu proti lokálnímu BE (Playwright): přihlášený
      otevře odkaz → doma sheet → vypne sdílení → Přijmout → je členem se
      `sharesWithGroup = false`, toast „Připojeno do skupiny …“.

## Poznámky

Na nativních platformách vizuálně neověřeno, jen web.
