# 0014 — Lepší always-on (nebo aspoň přes den zapnutý) backend

- **Stav:** todo
- **Priorita:** 1 (musí být hotové před veřejným releasem)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Týká se serverové infrastruktury (`apps/be` na Azure Container Apps) —
backend by měl běžet spolehlivěji nepřetržitě, nebo aspoň po celý den, aby
se předešlo cold startům/výpadkům při škálování na nulu.

**Zjištěný current stav (2026-09-06):** `apps/be/app.yaml` má scale-to-zero
aktivně nakonfigurované (`minReplicas: 0`, `maxReplicas: 1`,
`cooldownPeriod: 300`) — po 5 minutách bez provozu instance padne na
nulu, další request způsobí cold start (stažení image, start .NET
runtime, `db.Database.Migrate()`). Deploy workflow toto nastavení
nemění.

**Rozhodnuto (přístup):** scheduled scaling přes den — min. 1 instance
jen v očekávané provozní době, scale-to-zero mimo ni (ne trvalé
`minReplicas: 1`, které by běželo — a stálo — nepřetržitě).

## Kritéria splnění

- [ ] Definováno očekávané "provozní okno" appky (konkrétní hodiny a
      časové pásmo) — k upřesnění s produktovým záměrem před
      implementací.
- [ ] Mechanismus, který mimo ruční zásah mění `minReplicas` v
      `apps/be/app.yaml`/Container Apps revizi podle denní doby (např.
      scheduled GitHub Action nebo Azure Logic App volající Azure
      CLI/REST).
- [ ] Mimo definované provozní okno zůstává povolené scale-to-zero
      (`minReplicas: 0`) beze změny stávajícího chování.
- [ ] Ověřeno, že přechod z 0 na 1 instanci na začátku okna proběhne
      dostatečně před očekávaným provozem, ne až na první request
      uživatele.
- [ ] Zdokumentován dopad na náklady (kolik hodin denně navíc poběží
      min. 1 instance oproti dnešnímu čistému scale-to-zero).

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
