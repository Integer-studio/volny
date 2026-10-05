# 0020 — Mazání účtu

- **Stav:** done
- **Datum vytvoření:** 2026-10-05

## Popis / kontext

Uživatel si musí umět smazat účet sám. Backend endpoint `DELETE /api/users/me`
(ověření heslem, `AccountDeleteDto`) už existoval, ale frontend ho nevolal,
a kaskáda na `Group.OwnerID` by s vlastníkem
smazala i celé jeho skupiny včetně ostatních členů.

## Kritéria splnění

- [x] V nastavení je sekce „Smazání účtu“ s inline potvrzením heslem
      (`apps/fe/app/settings.tsx`), špatné heslo ukáže chybu a uživatel
      zůstane přihlášený.
- [x] Po smazání se smaže lokální session a aplikace přejde na přihlášení
      (`deleteAccount` v `apps/fe/lib/auth-context.tsx`).
- [x] Vlastněné skupiny převezme člen s nejstarším `JoinedAt`; skupina bez
      dalších členů se smaže (`UsersController.DeleteMe`).

## Poznámky

- Rozhodnutí: přátelům ani spolučlenům se o smazání nic neposílá (žádné
  realtime ani push notifikace) - smazaný uživatel jim zmizí při dalším
  načtení dat.
- Rozhodnutí: mazání je okamžité a nevratné (žádná ochranná lhůta),
  potvrzuje se jen heslem.
- Backend ověřen curlem proti lokální DB: 400 pro špatné/prázdné heslo, 204,
  předání skupiny, smazání samotné skupiny, 401 pro refresh i login.
- Push zařízení a refresh tokeny mizí kaskádou, proto FE po smazání nevolá
  `unregisterPushToken` ani `POST /auth/logout` (jen `api.clearSession()`).
