# Task tracker

Jednoduchý souborový task tracker nezávislý na GitHub Issues — funguje i bez
přístupu ke GitHubu a je čitelný přímo v repozitáři. Úkol může přidat
kdokoliv (člověk i AI agent), stejně tak si kdokoliv může existující úkol
vzít a dopracovat.

## Stavy

- `todo` — čeká na vyzvednutí.
- `in progress` — někdo (nebo nějaký agent) na tom aktuálně pracuje.
- `done` — hotovo.

## Jak přidat nový úkol

1. Zkopíruj [`sablona.md`](./sablona.md) do nového souboru
   `NNNN-strucny-nazev.md` v této složce (`NNNN` je další volné čtyřmístné
   číslo, viz tabulky níže).
2. Vyplň všechna pole v šabloně.
3. Přidej řádek do tabulky [Otevřené úkoly](#otevřené-úkoly) se stavem `todo`.

## Jak si úkol vzít / dokončit

1. Otevři si soubor úkolu, přečti kontext a kritéria splnění.
2. Přepni stav v tabulce i v hlavičce souboru úkolu na `in progress`.
3. Po dokončení nastav stav na `done` a přesuň řádek z tabulky
   [Otevřené úkoly](#otevřené-úkoly) do [Hotové úkoly](#hotové-úkoly). Pokud
   úkol souvisí s PR, odkaž na něj v poznámkách souboru úkolu.

Priorita: 1 = musí být hotové před veřejným releasem, 2 = důležité, ale
nebrání releasu, 3 = polish/nice-to-have. U hotových/rozpracovaných tasků z
doby před zavedením priorit je uvedena orientačně.

## Otevřené úkoly

| ID   | Název                                          | Stav        | Priorita | Soubor                                                               |
| ---- | ---------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------- |
| 0005 | Web push notifikace pro iOS (Safari)           | in progress | 1        | [0005-ios-safari-web-push.md](./0005-ios-safari-web-push.md)         |
| 0007 | Nové zadávání času                             | in progress | 1        | [0007-nove-zadavani-casu.md](./0007-nove-zadavani-casu.md)           |
| 0008 | Scheduled začátek volna (max. den dopředu)     | todo        | 2        | [0008-scheduled-zacatek-volna.md](./0008-scheduled-zacatek-volna.md) |
| 0010 | Vlastní čas (manuální zadání)                  | todo        | 3        | [0010-vlastni-cas.md](./0010-vlastni-cas.md)                         |
| 0012 | "Kde jsem" políčko (volný text)                | todo        | 3        | [0012-kde-jsem-policko.md](./0012-kde-jsem-policko.md)               |
| 0014 | Lepší always-on backend                        | todo        | 1        | [0014-always-on-backend.md](./0014-always-on-backend.md)             |
| 0032 | Dark mode                                      | todo        | 3        | [0032-dark-mode.md](./0032-dark-mode.md) |

## Skupiny otevřených úkolů

Úkoly, které má smysl dělat spolu (jedna větev / PR), protože sahají na
stejné soubory nebo mají společnou příčinu. Sestaveno 2026-10-07.
Doporučené pořadí: 0 → A → B → C (0014 paralelně) → D → E → F → G.

- **0. Prerekvizita — toasty a `Button`:** 0027 + sdílený `Button`
  s `loading`/`disabled` z 0030. Na tom stojí hlášení chyb v 0023, 0028 a
  0030 (toasty se dnes pod `ProfileSheet`/`GroupInviteSheet` neukážou).
- **A. Zápis stavu volna na hlavní obrazovce:** 0025 + 0024, k tomu z 0031
  genitivní popisky presetů, nadpis před označením, `busy` hlavního
  tlačítka a `useNow`, a z 0011 rozhodnutí o fallbacku "+2 h" (pak 0011
  zavřít). Dvojťuk a rychlý rollback z 0025 spouští race v `Reveal` z 0024.
- **B. Přátelé a hledání:** 0023 + hledací části 0026 (načítání/chyba místo
  "nikdo") a 0030 (potvrzení odebrání přítele, sheet pozvánky přítele)
  + labely ikonových tlačítek z 0031. Hlavně `app/search.tsx`,
  `ProfileSheet`, `FriendSuggestionsController`, `UsersController`.
- **C. Studený backend:** 0014 (BE infra, samostatný PR — odloženo) + login/boot část
  0028 + zbytek 0026 (hlavní obrazovka, skupiny, pozvánky).
- **D. Účet a nastavení:** formulář a session z 0028 + autosave z 0029 +
  sjednocené texty z 0031 (uživatelské jméno, "zabrané/obsazené",
  `FormField`, `BootSplash`).
- **E. Notifikace a ověření na iPhonu:** 0005 + oznamovací část 0029 + iOS
  ověření z 0007 (0005 i 0007 čekají jen na test na reálném iPhonu).
- **F. Skupiny — destruktivní akce:** zbytek 0030 + plurál "členů" a QR
  sheet skupiny z 0031.
- **G. Rozšíření modelu volna:** 0008 + 0012 (obojí mění `FreeTime`/
  `FreeTimeCreateDto` a zobrazení v `UserRow`/`StatusHeadline`).
- **Samostatně:** 0010 (čas na minuty), 0032 (dark mode).

## Hotové úkoly

| ID   | Název                                                             | Stav | Priorita | Soubor                                                                               |
| ---- | ----------------------------------------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------ |
| 0001 | Realtime aktualizace (volní lidé, friend requesty)                | done | 1        | [0001-realtime-aktualizace.md](./0001-realtime-aktualizace.md)                       |
| 0002 | Zjistit a definovat stav oznámení (mobil i web)                   | done | —        | [0002-stav-oznameni.md](./0002-stav-oznameni.md)                                     |
| 0003 | Zmenšit velikost APK                                              | done | —        | [0003-velikost-apk.md](./0003-velikost-apk.md)                                       |
| 0004 | Web push notifikace                                               | done | —        | [0004-web-push-notifikace.md](./0004-web-push-notifikace.md)                         |
| 0006 | Nepovinný telefon a IG při registraci + disclaimer o viditelnosti | done | 1        | [0006-nepovinny-telefon-ig-registrace.md](./0006-nepovinny-telefon-ig-registrace.md) |
| 0009 | User-based nastavení presetů (jméno, ikonka, přidávání/odebírání) | done | 2        | [0009-user-presety.md](./0009-user-presety.md)                                       |
| 0011 | Přichycení (snap) času na nejbližší preset                        | done | 1        | [0011-snap-casu-na-preset.md](./0011-snap-casu-na-preset.md)                         |
| 0013 | Lubomír mode on/off (vypnutý stav bez obrázků)                    | done | 1        | [0013-lubomir-mode.md](./0013-lubomir-mode.md)                                       |
| 0015 | Rozvedení zadání nových tasků (0006–0014, 0016)                   | done | 1        | [0015-rozvedeni-novych-tasku.md](./0015-rozvedeni-novych-tasku.md)                   |
| 0016 | Sessions nevydrží dostatečně dlouho (JWT bez refresh tokenu)      | done | 1        | [0016-sessions-nevydrzi-po-scaledownu.md](./0016-sessions-nevydrzi-po-scaledownu.md) |
| 0017 | Osobní friend QR kód viditelný při načtení stránky                | done | 2        | [0017-qr-kod-viditelny-pri-nacteni.md](./0017-qr-kod-viditelny-pri-nacteni.md)       |
| 0018 | Haptika prstencového zadávání času                                | done | 2        | [0018-haptika-prstence.md](./0018-haptika-prstence.md)                               |
| 0019 | Interaktivní onboarding po registraci                             | done | 1        | [0019-onboarding-po-registraci.md](./0019-onboarding-po-registraci.md)               |
| 0020 | Mazání účtu                                                       | done | 1        | [0020-mazani-uctu.md](./0020-mazani-uctu.md)                                         |
| 0021 | Toggle ve skupině: sdílet volno a kontakt                         | done | 2        | [0021-skupina-toggle-volno-a-kontakt.md](./0021-skupina-toggle-volno-a-kontakt.md)   |
| 0022 | Pozvánka do skupiny jako sheet (přijmout/odmítnout + sdílení)   | done | 2        | [0022-pozvanka-do-skupiny-sheet.md](./0022-pozvanka-do-skupiny-sheet.md)             |
| 0024 | Mizející rychlá volba (presety)                | done | 1        | [0024-mizejici-presety.md](./0024-mizejici-presety.md) |
| 0025 | Souběh zápisů stavu volna a falešné chyby      | done | 1        | [0025-soubeh-zapisu-stavu-volna.md](./0025-soubeh-zapisu-stavu-volna.md) |
| 0023 | Zpětná vazba při posílání žádostí o přátelství | done | 1        | [0023-feedback-zadosti-o-pratelstvi.md](./0023-feedback-zadosti-o-pratelstvi.md) |
| 0027 | Toasty pod modaly, umístění toastu a banneru   | done | 2        | [0027-toasty-a-bannery.md](./0027-toasty-a-bannery.md) |
| 0026 | Prázdné stavy místo načítání nebo chyby        | done | 1        | [0026-prazdne-stavy-vs-nacitani.md](./0026-prazdne-stavy-vs-nacitani.md) |
| 0028 | Přihlášení a registrace: zpětná vazba a chyby  | done | 1        | [0028-prihlaseni-a-registrace-ux.md](./0028-prihlaseni-a-registrace-ux.md) |
| 0029 | Nastavení a oznámení: autosave a povolení      | done | 2        | [0029-nastaveni-a-oznameni-ux.md](./0029-nastaveni-a-oznameni-ux.md) |
| 0030 | Potvrzení a busy stavy u destruktivních akcí   | done | 2        | [0030-potvrzeni-a-busy-stavy.md](./0030-potvrzeni-a-busy-stavy.md) |
| 0031 | Přístupnost a texty                            | done | 3        | [0031-pristupnost-a-texty.md](./0031-pristupnost-a-texty.md) |
