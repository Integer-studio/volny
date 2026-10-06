# 0021 — Toggle ve skupině: sdílet volno a kontakt všem členům

- **Stav:** todo
- **Priorita:** 2 (důležité, ale nebrání releasu)
- **Datum vytvoření:** 2026-10-06

## Popis / kontext

V zobrazení skupiny (`apps/fe/app/groups/`) má být toggle, kterým uživatel
nastaví, že **všem členům dané skupiny**:

1. se posílá informace, že je volný (stejně jako dnes přátelům), a zároveň
2. se zobrazují jeho kontaktní údaje (telefon, Instagram), **i když spolu
   nejsou přátelé**.

Dnes se volno a kontaktní údaje (`Phone`, `Instagram` v
`apps/be/SemFre/Dtos/UserDtos.cs`) zobrazují jen přátelům; členství ve
skupině samo o sobě viditelnost neotevírá. Toggle je tedy explicitní opt-in
uživatele pro konkrétní skupinu.

Per-skupinové nastavení patří k členství — `GroupMember`
(`apps/be/SemFre/Models/GroupMember.cs`) by dostal nové boolean pole
(nová DB migrace), ne pole na `User`.

## Kritéria splnění

- [ ] Upřesnit zadání: zda je toggle jeden společný (volno + kontakt), nebo
      dva oddělené, a jak se volno členům skupiny doručuje (push/realtime
      stejně jako přátelům — viz `FreeTimesController`, `IRealtimeNotifier`).
- [ ] Nové pole na `GroupMember` (nová migrace) + zahrnutí do
      `GroupDtos.cs` a endpoint/validace v `GroupsController`.
- [ ] Toggle v zobrazení skupiny ve FE; výchozí stav vypnuto (opt-in).
- [ ] BE vrací členům skupiny kontaktní údaje uživatele, který toggle zapnul,
      i když nejsou přátelé; po vypnutí se přestanou vracet.
- [ ] Zapnutý toggle zpřístupní členům skupiny i stav "jsem volný" (včetně
      notifikací/realtime) i bez přátelství.
- [ ] UI jasně informuje, že zapnutí zpřístupní kontakt i nepřátelům ve
      skupině (podobně jako disclaimer z [0006](./0006-nepovinny-telefon-ig-registrace.md)).

## Poznámky

Zadáno uživatelem 2026-10-06. Osobní údaje (kontakt) — držet striktně
opt-in a per-skupina.
