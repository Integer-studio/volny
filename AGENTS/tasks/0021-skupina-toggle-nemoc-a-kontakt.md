# 0021 — Toggle ve skupině: sdílet nemoc a kontakt všem členům

- **Stav:** todo
- **Priorita:** 2 (důležité, ale nebrání releasu)
- **Datum vytvoření:** 2026-10-06

## Popis / kontext

V zobrazení skupiny (`apps/fe/app/groups/`) má být toggle, kterým uživatel
nastaví, že **všem členům dané skupiny**:

1. se posílá informace, že je nemocný, a zároveň
2. se zobrazují jeho kontaktní údaje (telefon, Instagram), **i když spolu
   nejsou přátelé**.

Dnes jsou kontaktní údaje (`Phone`, `Instagram` v `apps/be/SemFre/Dtos/UserDtos.cs`)
viditelné jen přátelům; členství ve skupině samo o sobě viditelnost
neotevírá. Toggle je tedy explicitní opt-in uživatele pro konkrétní skupinu.

**Pozor — ověřit před implementací:** v kódu (BE ani FE) zatím neexistuje
žádný koncept "nemocný" stavu ani jeho notifikace. Je potřeba upřesnit, co
přesně se "posílá" (push/realtime notifikace, nebo jen stav zobrazený
u uživatele) a jak se nemoc nastavuje. Pravděpodobně vznikne jako samostatný
základ, na který toggle naváže.

Per-skupinové nastavení patří k členství — `GroupMember`
(`apps/be/SemFre/Models/GroupMember.cs`) by dostal nové boolean pole
(nová DB migrace), ne pole na `User`.

## Kritéria splnění

- [ ] Upřesnit zadání: co je "nemocný" stav a jak se šíří (notifikace vs.
      zobrazení) a zda je toggle jeden společný, nebo dva oddělené.
- [ ] Nové pole na `GroupMember` (nová migrace) + zahrnutí do
      `GroupDtos.cs` a validace/endpointu v `GroupsController`.
- [ ] Toggle v zobrazení skupiny ve FE; výchozí stav vypnuto (opt-in).
- [ ] BE vrací členům skupiny kontaktní údaje uživatele, který toggle zapnul,
      i když nejsou přátelé; po vypnutí se přestanou vracet.
- [ ] Zapnutý toggle posílá ostatním členům informaci o nemoci
      (způsob dle upřesnění výše).
- [ ] UI jasně informuje, že zapnutí zpřístupní kontakt i nepřátelům ve
      skupině (podobně jako disclaimer z [0006](./0006-nepovinny-telefon-ig-registrace.md)).

## Poznámky

Zadáno uživatelem 2026-10-06. Citlivá data (zdravotní stav, kontakt) — držet
striktně opt-in a per-skupina.
