# 0013 — Lubomír mode on/off (vypnutý stav bez obrázků Lubomíra Volného)

- **Stav:** todo
- **Priorita:** 1 (musí být hotové před veřejným releasem — právní riziko používání podobizny reálné osoby bez svolení, viz Poznámky)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

`volny.png` a podobné assety v appce používají obrázek politika Lubomíra
Volného. V nastavení má být možnost tyto obrázky vypnout a nahradit je
generickými ikonkami ("Lubomír mode" on/off).

Jde zatím jen o zadání přenesené z poznámek — konkrétní řešení (které
assety, jaké náhradní ikonky, kde v nastavení) se dořeší později.

## Kritéria splnění

- [ ] ...

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
