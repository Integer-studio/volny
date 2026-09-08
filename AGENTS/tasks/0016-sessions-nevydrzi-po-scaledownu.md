# 0016 — Sessions nevydrží dostatečně dlouho (JWT bez refresh tokenu, TTL 2 h)

- **Stav:** in progress
- **Priorita:** 1 (musí být hotové před veřejným releasem)
- **Datum vytvoření:** 2026-09-06

## Popis / kontext

Uživatelské sessions nevydrží tak dlouho, jak by měly. Původní podezření
bylo, že backend (`apps/be`, Azure Container Apps) je zahazuje při
scale-downu (session držené jen in-memory).

**Ověřeno (2026-09-06) — podezření neplatí, skutečná příčina je jiná:**
appka nemá žádnou server-side session (žádné `AddSession`, cookie auth,
ASP.NET Core Identity ani `AddDataProtection`) — autentizace je čistě
stateless JWT (`AddJwtBearer` v `Program.cs`). JWT má natvrdo nastavenou
platnost `Jwt:ExpiresMinutes` = **120 minut** a **neexistuje žádný refresh
token** — po 2 hodinách je uživatel odhlášen a musí se přihlásit znovu,
úplně bez ohledu na škálování/scaledown backendu. Škálování na nulu tedy
není příčina; token je stateless a jeho (ne)platnost nezávisí na běžící
instanci.

**Rozhodnuto (řešení):** zavést refresh token pattern — krátkodobý access
token (dnešní JWT, TTL může zůstat 120 min) + dlouhodobější refresh token
uložený persistentně na BE (SQLite na `/data` Azure Files volume je už
persistentní) a bezpečně na FE (`SecureStore`). FE si před vypršením nebo
po 401 tiše vyžádá nový access token a původní request zopakuje —
uživatel není odhlášen, dokud nevyprší i refresh token nebo není
revokovaný.

Souvisí s [0014](./0014-always-on-backend.md) jen okrajově (obojí se týká
spolehlivosti BE), technicky jde ale o nezávislé opravy — 0014 řeší
uptime/cold starty, tento task řeší auth/token lifecycle a je na 0014
nezávislý.

## Kritéria splnění

- [x] Nový endpoint (`POST /api/auth/refresh`) přijme refresh token
      a vrátí nový access token (JWT), bez nutnosti opětovného přihlášení
      heslem.
- [x] Refresh token je uložen persistentně v DB (nová tabulka
      `RefreshTokens`, hashovaný SHA-256) s možností revokace (odhlášení
      přes nový `POST /api/auth/logout`, změna hesla přes
      `UsersController.ChangePassword`, smazání účtu přes cascade FK).
- [x] FE (`apps/fe/lib/api.ts`) ukládá refresh token bezpečně (přes
      `Storage`/`SecureStore`, stejně jako access token) a transparentně
      obnovuje access token na pozadí při 401 (`tryRefreshAccessToken` +
      retry v `performRequest`) — uživatel není odhlášen ani nemusí nic
      dělat, dokud je refresh token platný.
- [x] Access token (JWT) TTL zůstává beze změny (120 min).
- [x] Refresh token má vlastní TTL, 90 dní
      (`Auth:RefreshTokenExpiresDays`, bez rotace při použití — vědomé
      zjednodušení, appka nemusí být "ultra secure").
- [ ] Ověřeno, že mechanismus funguje nezávisle na scale-to-zero/deploy
      backendu v reálném Azure prostředí — z návrhu to plyne (SQLite na
      persistent volume, žádný in-memory stav), ale reálné ověření
      (kill/restart Container App mezi requesty) vyžaduje přístup k
      běžícímu Azure prostředí, který v tomto sezení nebyl k dispozici.

## Poznámky

**Implementace (2026-09-08):** BE — nová entita `Models/RefreshToken.cs`
+ migrace `AddRefreshTokens`, `Services/RefreshTokenService.cs`
(`IssueAsync`/`ValidateAsync`/`RevokeAsync`/`RevokeAllForUserAsync`),
`AuthController.Login` teď vrací `{ token, refreshToken }`, nové
`POST /api/auth/refresh` a `POST /api/auth/logout`,
`UsersController.ChangePassword` revokuje všechny refresh tokeny uživatele.
FE — `api.ts`: `login()`/`logout()` ukládají/mažou `refreshToken` ve
`Storage`, `performRequest` při 401 zkusí jednou tichý refresh (sdílený
in-flight promise pro deduplikaci souběžných 401) a request zopakuje, až
při neúspěchu spadne do původního chování (logout + `onUnauthorized`).
`logout()` navíc best-effort (fire-and-forget) revokuje token na BE.

Ověřeno `dotnet build`, vygenerovaná migrace aplikovaná na testovací
SQLite DB, plný `curl` smoke test (register → login → refresh → logout →
refresh po logoutu je 401 → change password revokuje starý refresh token
→ delete účtu cascade-smaže jeho refresh tokeny) a `npx tsc --noEmit` na
FE beze chyb. Neověřeno v tomto prostředí: perzistence refresh tokenu v
`expo-secure-store` přes restart appky na reálném zařízení, a chování
mechanismu při reálném scale-to-zero/deployi na Azure — obojí vyžaduje
manuální průchod uživatelem.

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
