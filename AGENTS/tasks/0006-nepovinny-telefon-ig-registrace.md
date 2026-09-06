# 0006 — Nepovinný telefon a IG při registraci + disclaimer o viditelnosti

- **Stav:** todo
- **Priorita:** 1 (musí být hotové před veřejným releasem)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Telefon a Instagram handle mají být při registraci nepovinná pole (aktuálně
patrně povinná nebo bez jasného stavu). Zároveň má uživatel při jejich
vyplňování vidět disclaimer, komu/kde jsou tyto údaje viditelné.

**Zjištěný current stav (2026-09-06):** Registrační formulář
(`apps/fe/app/sign-in.tsx`) dnes sbírá jen `name`, `username` a `password`
— telefon a Instagram se při registraci vůbec nezadávají. Editují se až
dodatečně v Nastavení (`apps/fe/app/settings.tsx`), kde jsou **už fakticky
nepovinné** (`validatePhone`/`validateInstagram` akceptují prázdný
řetězec, BE model `User.Phone`/`User.Instagram` jsou nullable,
`UserProfileUpdateDtoValidator` je validuje jen když nejsou prázdné) a
**disclaimer už existuje** (sekce "KONTAKT" v `settings.tsx`: „Vidí ho jen
přátelé a spolučlenové skupin, nikdo jiný.“ — odpovídá skutečné viditelnosti
v `UsersController`/`UserProfileDto`).

**Rozhodnuto:** telefon a Instagram se mají přidat jako volitelná pole
přímo do registračního formuláře (ne jen řešit dodatečně v Nastavení).

## Kritéria splnění

- [ ] Registrační formulář (`apps/fe/app/sign-in.tsx`) obsahuje volitelná
      pole Telefon a Instagram vedle jméno/username/heslo, se stejnou
      validací jako v Nastavení (prázdná hodnota je platná).
- [ ] U obou polí je viditelný disclaimer o viditelnosti — stejné znění
      jako v Nastavení („Vidí ho jen přátelé a spolučlenové skupin, nikdo
      jiný.“) nebo jeho ekvivalent přizpůsobený kontextu registrace.
- [ ] Backend `UserRegisterDto` (`apps/be/SemFre/Dtos/UserDtos.cs`)
      rozšířen o nepovinné `Phone`/`Instagram`, s validací analogickou
      `UserProfileUpdateDtoValidator` (validuje jen když není prázdné).
- [ ] Hodnoty zadané při registraci se uloží a zůstávají editovatelné
      stejně jako dnes v Nastavení — žádná duplicitní validační logika.
- [ ] Ověřeno, že viditelnost zůstává beze změny — telefon/IG vidí jen
      přátelé/spolučlenové skupiny, stejně jako dnes.

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
