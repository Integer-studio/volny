# 0017 — Osobní friend QR kód viditelný hned při načtení stránky

- **Stav:** in progress
- **Datum vytvoření:** 2026-09-07

## Popis / kontext

V `apps/fe/app/search.tsx` je osobní QR kód pro přidání do přátel aktuálně
schovaný za tlačítkem (ikona `QrCode`, řádek ~147–152), které otevře
`BottomSheet` s QR kódem (`QRCodeSvg`, řádek ~254). Uživatel tak musí vědět,
že tlačítko existuje, a kliknout na něj, než může kód nechat ostatními
naskenovat.

Cíl: QR kód by měl být hned viditelný a snadno naskenovatelný při otevření
stránky (search / přátelé), ne schovaný za extra krokem — typicky ve chvíli,
kdy uživatel potká někoho osobně a chce kód rychle nastavit. Zároveň by ale
neměl zabírat místo/rušit ve chvíli, kdy uživatel aktivně něco vyhledává —
navrhovaná varianta je, že se velký QR kód po zahájení vyhledávání
(zadání do vyhledávacího pole) schová/zmenší, a po vyprázdnění pole se zase
zobrazí.

Otázky k doladění při implementaci:
- Má QR úplně zmizet, nebo se jen zmenšit/sbalit do menší podoby?
- Má se dál nechat i cesta přes tlačítko/BottomSheet (např. jako fallback),
  nebo se má nahradit úplně?

## Kritéria splnění

- [x] Po otevření stránky s osobním QR kódem (`apps/fe/app/search.tsx`) je
      QR kód rovnou vidět jako velký, snadno naskenovatelný prvek — bez
      nutnosti kliknout na tlačítko.
- [x] Po zahájení vyhledávání (uživatel začne psát do vyhledávacího pole)
      se velký QR kód schová/zmenší, aby nepřekážel výsledkům hledání.
- [x] Po vymazání vyhledávacího dotazu se QR kód opět zobrazí.
- [x] Zachováno současné chování generování/regenerace kódu
      (`myInvite`, `regenerating`, `api.getMyFriendInviteCode()`).

## Poznámky

Zvážit, zda `BottomSheet` s QR kódem (řádky ~246+) zůstat jako existující
kód nebo ho nahradit inline zobrazením přímo na stránce.

Rozhodnutí při implementaci (2026-10-05):
- V klidovém stavu je QR (180 px) inline kartou pod vyhledávacím polem nad
  žádostmi, i s akcemi Kopírovat / Sdílet / Nový kód. Ikona vedle pole se
  v tomhle stavu nezobrazuje.
- Při hledání se karta sbalí do ikony vedle pole, která otevře původní
  `BottomSheet`. Sheet tedy zůstává jako fallback.
- Text kódu (slug) ani „Platí 24 hodin“ se už nezobrazují v kartě ani v sheetu.
- Krok tour `friendsQr` teď zvýrazňuje kartu, ne ikonu.
- Společný obsah karty a sheetu je komponenta `MyQrContent` v `app/search.tsx`.
