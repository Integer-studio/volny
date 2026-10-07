# 0028 — Přihlášení a registrace: zpětná vazba a chyby

- **Stav:** todo
- **Priorita:** 1
- **Datum vytvoření:** 2026-10-07

## Popis / kontext

- **Kontrola "jméno je zabrané" nikdy nefunguje** — `sign-in.tsx` volá
  `api.searchUsers` nepřihlášeně, ale `UsersController` má `[Authorize]`.
  Request dostane 401, `request()` zkusí refresh a zavolá `api.logout()` +
  `onUnauthorized` (při každém psaní) a `.catch(() => [])` chybu spolkne.
  Uživatel se o obsazeném jménu dozví až po odeslání.
- **Studený backend při přihlášení** — `login` je POST bez `idempotent`,
  takže se neretryuje. Timeout je 25 s, chybí `useSlowActionNotice` a 503
  skončí obecným "Nepodařilo se přihlásit".
- **Boot na studeném backendu** (`lib/auth-context.tsx`) — po neúspěšných
  pokusech skončí v `signedOut`, i když token platí. Uživatel po dlouhém
  splashi vidí login bez vysvětlení.
- **Vypršení session je tiché** — `signOutInternal` jen přepne na login,
  bez hlášky, a aktuální route se ztratí.
- **Registrace projde, ale navazující login selže** → uživatel zkusí znovu a
  dostane "jméno je zabrané" na vlastní účet.
- **Formulář** — chybí `KeyboardAvoidingView`/`ScrollView` (na malých
  telefonech klávesnice překryje "Zaregistrovat"), chybí
  `returnKeyType`/`onSubmitEditing` (Enter na webu nic nedělá).
- **Smazání účtu** skončí potichu na přihlášení. Chybí "Účet byl smazán".

## Kritéria splnění

- [ ] Anonymní `GET /auth/username-available` (nebo pre-check zrušit).
      Žádný logout při psaní.
- [ ] Login: `useSlowActionNotice`, retry (`idempotent: true`), srozumitelná
      hláška pro 502/503/504/timeout.
- [ ] Boot: stav "Server neodpovídá · Zkusit znovu" místo přepnutí na login.
      Login jen po skutečném 401.
- [ ] Toast "Přihlášení vypršelo" (ideálně i návrat na původní route).
- [ ] Register OK + login fail → přepnout na přihlášení s vyplněnými poli a
      hláškou "Účet je vytvořený, přihlas se".
- [ ] Klávesnice a Enter fungují.
- [ ] Toast po smazání účtu.
