# 0016 — Sessions nevydrží dostatečně dlouho (podezření: BE je zahazuje po scaledownu)

- **Stav:** todo
- **Priorita:** 1 (musí být hotové před veřejným releasem)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Uživatelské sessions nevydrží tak dlouho, jak by měly — podezření je, že
backend (`apps/be`, Azure Container Apps) je zahazuje při scale-downu
(pokud jsou session držené jen in-memory a ne perzistentně, škálování na
nulu/méně instancí by je smazalo).

Souvisí s [0014](./0014-always-on-backend.md) (lepší always-on backend) —
možná jde o stejný kořenový problém (scale-to-zero/cold starty), možná je
potřeba řešit odděleně (např. přesunout session state z paměti do
perzistentního úložiště bez ohledu na uptime).

Jde zatím jen o zadání přenesené z poznámky — příčina není potvrzená,
potřeba nejdřív ověřit/diagnostikovat.

## Kritéria splnění

- [ ] Ověřeno, zda a jak backend session state ukládá (in-memory vs.
      perzistentní úložiště) a zda scaledown skutečně způsobuje ztrátu
      sessions.
- [ ] Sessions vydrží po celou očekávanou dobu bez ohledu na
      škálování/restart instancí backendu i na deploy nové verze.

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).

Sessions by měly přežít i deploy nové verze backendu, ne jen scaledown —
pokud řešení bude in-memory only, nový deploy (nové instance) by je
smazal stejně jako scaledown.
