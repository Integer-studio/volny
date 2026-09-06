# 0016 — Sessions nevydrží dostatečně dlouho (JWT bez refresh tokenu, TTL 2 h)

- **Stav:** todo
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

- [ ] Nový endpoint (např. `POST /api/auth/refresh`) přijme refresh token
      a vrátí nový access token (JWT), bez nutnosti opětovného přihlášení
      heslem.
- [ ] Refresh token je uložen persistentně v DB (nová tabulka/entita) s
      možností revokace (např. při odhlášení, změně hesla).
- [ ] FE (`apps/fe/lib/api.ts`/auth vrstva) ukládá refresh token
      bezpečně (`SecureStore`) a transparentně obnovuje access token na
      pozadí — uživatel není odhlášen ani nemusí nic dělat, dokud je
      refresh token platný.
- [ ] Access token (JWT) TTL zůstává krátký (dnešních 120 min je v
      pořádku) — bezpečnost stojí na krátkém access tokenu +
      revokovatelném refresh tokenu, ne na prodlužování JWT.
- [ ] Refresh token má vlastní (delší) TTL, řádově týdny — po jeho
      vypršení se uživatel musí přihlásit znovu.
- [ ] Ověřeno, že mechanismus funguje nezávisle na scale-to-zero/deploy
      backendu (celý je stavový přes DB, ne in-memory) — scaledown ani
      nový deploy nezpůsobí odhlášení.

## Poznámky

Vzniklo jako součást dávky nových tasků 2026-09-06, rozvedeno v [0015](./0015-rozvedeni-novych-tasku.md).
