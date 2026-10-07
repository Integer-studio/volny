# 0014 — Lepší always-on (nebo aspoň přes den zapnutý) backend

- **Stav:** done
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

- [x] Provozní okno: **7:00–21:00**, mimo něj platí stávající
      scale-to-zero beze změny.
- [x] Mechanismus, který mimo ruční zásah mění `minReplicas` v
      `apps/be/app.yaml`/Container Apps revizi podle denní doby (např.
      scheduled GitHub Action nebo Azure Logic App volající Azure
      CLI/REST).
- [x] Mimo definované provozní okno zůstává povolené scale-to-zero
      (`minReplicas: 0`) beze změny stávajícího chování.
- [x] Ověřeno, že přechod z 0 na 1 instanci na začátku okna proběhne
      dostatečně před očekávaným provozem, ne až na první request
      uživatele.
- [x] Zdokumentován dopad na náklady (kolik hodin denně navíc poběží
      min. 1 instance oproti dnešnímu čistému scale-to-zero).

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).

**2026-10-07 (skupina C):** Hotové jako
[`volny-be-scheduled-scaling.yml`](../../.github/workflows/volny-be-scheduled-scaling.yml):

- Cron v UTC běží ráno i večer dvakrát (letní/zimní čas). Každý běh si
  spočítá stav podle pražského času (náběh 6:30–21:00 → `minReplicas: 1`,
  jinak `0`) a `az containerapp update --min-replicas` volá jen při změně.
- Náběh začíná o půl hodiny dřív kvůli zpoždění cronu v GitHub Actions. Po
  náběhu krok "Warm up" čeká na `GET /api/health`, takže instance je teplá
  před provozem a selhání je vidět v Actions.
- `workflow_dispatch` umí vynutit 0/1 ručně.
- Používá stejné OIDC přihlášení jako deploy workflow. Plánované běhy
  GitHub spouští jen z `main`, takže se projeví až po merge. Ověřit pak
  první ranní běh v Actions (log "Health OK").

**Náklady:** 0,25 vCPU / 0,5 GiB, okno 14,5 h denně ≈ 435 h/měsíc navíc
proti čistému scale-to-zero (≈ 1,57 mil. s). Minimální replika bez provozu
se účtuje idle sazbou (orientačně 0,000003 USD za vCPU-s i GiB-s): ≈ 1,2 USD
za CPU + 2,3 USD za paměť, tedy ~3,5 USD/měsíc, z části pokryté měsíčním
free grantem Consumption plánu (180 000 vCPU-s, 360 000 GiB-s). Kdyby
instance celé okno aktivně zpracovávala requesty, horní mez je ~12 USD/měsíc.
Sazby jsou z ceníku Azure, před spolehnutím ověřit v kalkulačce pro
Germany West Central.
