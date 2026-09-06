# 0009 — User-based nastavení presetů (jméno, ikonka, přidávání/odebírání)

- **Stav:** todo
- **Priorita:** 2 (důležité, ale nebrání releasu)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Presety (rychlé volby pro zadávání času/stavu) má jít uživatelsky nastavit:
vlastní jméno, vlastní ikonka, možnost preset přidat i odebrat — ne jen
vybírat z pevně dané sady.

**Zjištěný current stav (2026-09-06):** Presety jako pojmenovaná/
konfigurovatelná entita **neexistují vůbec** — ani na FE, ani na BE.
Nejbližší analogie je natvrdo dané pole `[1, 2, 3, 5]` (hodinové offsety)
v `apps/fe/app/index.tsx`. Jde tedy o zavedení zcela nové entity.

## Kritéria splnění

- [ ] Nová entita "preset" (jméno, ikonka, hodnota/offset, pořadí)
      nahrazuje natvrdo dané pole `[1, 2, 3, 5]` v `apps/fe/app/index.tsx`.
- [ ] Uživatel může presety přidávat, přejmenovávat, měnit ikonku a mazat.
- [ ] Ikonky se vybírají ze stávající sady používané v appce
      (`lucide-react-native`, viz `SettingsIcon`, `UserPlus`, `Users` v
      `index.tsx`), ne z nového icon systému.
- [ ] Nové UI pro zadávání času ([0007](./0007-nove-zadavani-casu.md))
      čte presety z této nové entity.

**K rozhodnutí před implementací:** presety uložit jen lokálně na
zařízení (AsyncStorage/SecureStore), nebo persistentně na backendu (nová
tabulka/endpoint, sync mezi zařízeními — analogicky k `FreeTime`)?
Doporučení: persistentně na BE, protože appka už dnes synchronizuje
profil/stav přes backend a uživatel běžně přechází mezi zařízeními (web/
mobil) — lokální řešení by se muselo nastavovat na každém zařízení znovu.
Ovlivňuje to ale rozsah práce (nutnost BE modelu/DTO/migrace), takže je
třeba to potvrdit před zahájením implementace.

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
Souvisí s [0007](./0007-nove-zadavani-casu.md), [0010](./0010-vlastni-cas.md) a
[0011](./0011-snap-casu-na-preset.md).
