# 0030 — Potvrzení a busy stavy u destruktivních akcí

- **Stav:** done
- **Priorita:** 2
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

Chování tlačítek je nekonzistentní, protože každá obrazovka si skládá
vlastní `Pressable`. Sdílený `components/ui/button` se nikde nepoužívá.

- **Odebrání přítele** v hledání (`search.tsx`, `handleRemove`) — jedno
  ťuknutí na koš přítele hned odebere, bez potvrzení. Při chybě se řádek
  potichu vrátí. `ProfileSheet` naopak potvrzení má.
- **Obnovení pozvánky / QR** (hledání i skupina) — jedno ťuknutí na ikonu
  bez popisku zneplatní všechny už rozeslané odkazy. Bez potvrzení.
- **Smazání / opuštění skupiny** (`groups/[id].tsx`) — bez spinneru a bez
  `disabled`. Dvojťuk pošle dva requesty. Na pomalé síti se nic neděje.
- **Přepínač sdílení ve skupině** — není zablokovaný během ukládání. Rychlé
  přepínání může rollbackem nastavit špatnou hodnotu. Jde o nastavení
  soukromí, a přesto chybí potvrzení.
- **Pozvánka do skupiny** — sheet jde během joinu zavřít scrimem / Android
  back, čímž se smaže pending pozvánka, ale join pak stejně může doběhnout.
- **Odkaz pozvánky přítele po přihlášení** (`PendingFriendInviteGate`)
  přidá přítele bez dotazu. Neplatný odkaz (404) zahodí potichu.
- **Zrušení web share** (`AbortError`) ukáže "Odkaz zkopírován.", i když
  uživatel nic kopírovat nechtěl.

## Kritéria splnění

- [x] Sdílený `Button` s `loading`/`disabled` použitý v těchto místech.
- [x] Potvrzení (inline, jako v `ProfileSheet`) u odebrání přítele a
      obnovení pozvánky. Při chybě toast (nebo undo).
- [x] Busy stav u smazání/opuštění skupiny a přepínače sdílení.
- [x] `BottomSheet` má `dismissable={false}` během běžící akce.
- [x] Pozvánka přítele: sheet přijmout/odmítnout (jako u skupin), na 404
      hláška "Pozvánka už neplatí".
- [x] `AbortError` ze share = zrušeno, bez toastu.

## Poznámky

**2026-10-07 (skupina 0):** Sdílený `components/Button.tsx` (varianty
`primary`/`secondary`/`destructive`/`destructiveOutline`, `icon`,
`loading`, `disabled`) je hotový. Zatím ho používá jen `ProfileSheet`.
Nativecn `components/ui/button` stojí na shadcn tokenech, které appka
nemá, takže zůstal nepoužitý. `BottomSheet` má `dismissable` a
`ProfileSheet` ho během akce vypíná. Zbylá místa z kritérií patří do
skupin B a F.

**2026-10-07 (skupina B):**
- Odebrání přítele v hledání se potvrzuje inline ("Zpět" / "Odebrat").
- Obnovení odkazu přítele chce potvrzení ("Starý odkaz i QR kód
  přestanou fungovat.").
- `PendingFriendInviteGate` ukáže `FriendInviteSheet` s
  přijmout/odmítnout. Na 404 hlásí "Pozvánka do přátel už neplatí."
- `AbortError` ze share vrací `cancelled`, bez toastu.
- `GroupInviteSheet` má během joinu `dismissable={false}`.
- Zbývá ve skupině F: smazání/opuštění skupiny, přepínač sdílení a
  potvrzení obnovy odkazu skupiny.

**2026-10-07 (skupina F):** Detail skupiny používá `Button`:
- Smazání a opuštění mají `loading` a zamčené "Zrušit", takže dvojťuk
  nepošle dva requesty. Po úspěchu se ukáže toast.
- Obnova odkazu skupiny chce inline potvrzení.
- Přepínač sdílení je během ukládání zamčený a při chybě se vrací na
  hodnotu ze serveru. Zapnutí, které odhalí kontakt, chce potvrzení,
  vypnutí ne.
