# 0010 — Vlastní čas (manuální zadání mimo presety)

- **Stav:** todo
- **Priorita:** 3 (polish/nice-to-have)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Nejde o obecné ruční zadání času mimo presety (to už řeší nové UI z
[0007](./0007-nove-zadavani-casu.md) s granularitou 15 minut) — jde o
možnost nastavit čas ještě přesněji, na minuty. Určeno pro "extra
perfekcionisty", ne pro běžné použití.

Jde zatím jen o zadání přenesené z poznámek — konkrétní řešení se dořeší
později.

## Kritéria splnění

- [ ] Doplňková volba "vlastní čas na minuty" dostupná vedle presetů/
      15minutového kroku z nového UI ([0007](./0007-nove-zadavani-casu.md))
      — např. přepnutí z kroku 15 min na volný `DateTimePicker` (Expo)
      nebo rozšíření slideru na granularitu 1 minuta.
- [ ] Datová vrstva nevyžaduje změnu — BE `DateTime` (UTC) podporuje
      libovolnou přesnost už dnes (viz zjištění v [0007](./0007-nove-zadavani-casu.md)).
- [ ] UI jasně odlišuje "rychlá volba/presety" od "přesný vlastní čas"
      (např. samostatné tlačítko/přepínač), aby běžný uživatel nemusel
      řešit minuty, pokud nechce.

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
Úzce souvisí s [0011](./0011-snap-casu-na-preset.md) (přichycení vlastního
času k nejbližšímu presetu) a [0009](./0009-user-presety.md).
