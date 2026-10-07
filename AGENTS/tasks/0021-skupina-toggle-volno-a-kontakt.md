# 0021 — Toggle ve skupině: sdílet volno a kontakt všem členům

- **Stav:** done
- **Priorita:** 2 (důležité, ale nebrání releasu)
- **Datum vytvoření:** 2026-10-06

## Popis / kontext

V zobrazení skupiny (`apps/fe/app/groups/`) má být toggle, kterým uživatel
nastaví, že **všem členům dané skupiny**:

1. se posílá informace, že je volný (stejně jako dnes přátelům), a zároveň
2. se zobrazují jeho kontaktní údaje (telefon, Instagram), **i když spolu
   nejsou přátelé**.

~~Dnes se volno a kontaktní údaje zobrazují jen přátelům.~~ Při
implementaci se ukázalo, že to neplatí: `ConnectionService` už bral
spoluelenky skupin jako spojení bez podmínky, takže volno (vč. push a
realtime) i kontakt v `ProfileSheet` vidí všichni členové skupiny. Toggle
proto funguje jako per-skupinový **opt-out**, výchozí stav zapnuto (viz
rozhodnutí níže).

Per-skupinové nastavení patří k členství — `GroupMember`
(`apps/be/SemFre/Models/GroupMember.cs`) by dostal nové boolean pole
(nová DB migrace), ne pole na `User`.

## Rozhodnutí (2026-10-07, se zadavatelem)

- **Jeden společný toggle** pro volno i kontakt.
- **Výchozí stav zapnuto** všude — stávající členové (migrace s
  `defaultValue: true`) i nově připojení. Zachovává dosavadní chování.
- **Vzájemné sdílení:** přes skupinu jsou dva členové spojení jen když mají
  toggle zapnutý oba. Kdo vypne, nesdílí a zároveň přes tu skupinu nevidí
  ostatní. Graf spojení tak zůstává symetrický.
- V seznamu členů se **nezobrazuje**, kdo sdílí.

## Kritéria splnění

- [x] Upřesnit zadání (viz Rozhodnutí).
- [x] Nové pole `GroupMember.SharesWithGroup` (migrace
      `AddGroupMemberSharesWithGroup`), `GroupDetailDto.SharesWithGroup`,
      endpoint `PUT /api/groups/{id}/sharing` (`{ sharesWithGroup }`, jen pro
      členy, jinak 404; při změně realtime `FreeChanged` členům skupiny).
- [x] Podmínka v `ConnectionService` (`GetConnectionsAsync` i
      `AreConnectedAsync`) — odtud ji přebírá `/connections/free`, push v
      `FreeTimesController`, čtení free-times, kontakt v
      `UsersController.GetProfile` i fan-out v `RealtimeNotifier`.
- [x] Toggle v detailu skupiny (`apps/fe/app/groups/[id].tsx`) s popisem,
      co zapnutí/vypnutí znamená (kontakt i nepřátelům, vzájemnost).
- [x] Ověřeno: migrace nad starou DB nastaví stávajícím členům `1`;
      end-to-end přes API (dva uživatelé, volno + profil + free-times,
      vypnutí → nic, opětovné zapnutí → vše zpět, nečlen → 404). FE prošlo
      `tsc`, vizuálně v appce zatím neověřeno.

## Poznámky

Zadáno uživatelem 2026-10-06. Osobní údaje (kontakt) — držet striktně
opt-in a per-skupina.

PR: https://github.com/Integer-studio/volny/pull/19
