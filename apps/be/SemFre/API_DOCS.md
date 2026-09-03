# SemFre API — Dokumentace pro frontend

Base URL: `http://localhost:5135`

Autentizace
- JWT Bearer v hlavičce `Authorization: Bearer <token>`.
- Získání tokenu: `POST /api/auth/login` -> `{ "token": "..." }`.
- Swagger UI podporuje vkládání `Bearer <token>` přes tlačítko Authorize.

Obecné poznámky
- Formát dat: JSON (application/json).
- Časové hodnoty: ISO 8601 (UTC doporučeno).
- Chybové kódy:
  - `400 Bad Request` — nevalidní vstup / chybějící parametry
  - `401 Unauthorized` — chybějící/neplatný token
  - `403 Forbidden` — pokus o přístup, který není povolen
  - `404 Not Found` — neexistující zdroj
  - `409 Conflict` — konflikt (duplicitní zápis, už přátelé apod.)

DTO (důležité schémata)
- `UserDto`
```json
{
  "userID": 1,
  "username": "string",
  "name": "string",
  "createdAt": "2026-08-31T12:00:00Z"
}
```
- `DeviceDto`
```json
{
  "deviceID": 1,
  "userID": 1,
  "deviceToken": "string",
  "platform": "android|ios|web",
  "lastActive": "2026-08-31T12:00:00Z"
}
```
- `FreeTimeDto`
```json
{
  "freeTimeID": 1,
  "userID": 2,
  "userName": "Jan Novák",
  "startTime": "2026-08-31T18:00:00Z",
  "endTime": "2026-09-01T00:00:00Z"
}
```
- `FriendSuggestionDto`
```json
{
  "suggesterID": 2,
  "suggesterName": "Alice",
  "suggestedID": 3,
  "suggestedName": "Bob",
  "suggestedAt": "2026-08-31T12:34:56Z"
}
```
- `FriendPairDto`
```json
{
  "friend1ID": 2,
  "friend1Name": "Alice",
  "friend2ID": 3,
  "friend2Name": "Bob",
  "establishedAt": "2026-08-31T12:34:56Z"
}
```

---

## 1) Auth

### POST /api/auth/register
- Auth: none
- Body:
```json
{ "username": "string", "password": "string", "name": "string" }
```
- Success: `201 Created` -> `UserDto` (bez hesla)
- Errors: `409` pokud uživatelské jméno existuje, `400` validace

### POST /api/auth/login
- Auth: none
- Body:
```json
{ "username": "string", "password": "string" }
```
- Success: `200 OK` -> `{ "token": "<jwt>" }`
- Errors: `401` neplatné údaje

Sample:
```
curl -X POST http://localhost:5135/api/auth/login -H "Content-Type: application/json" -d '{"username":"test","password":"test123"}'
```

---

## 2) Users

### GET /api/users?q={q}
- Auth: optional
- Query: `q` (required) — substring match in `username` OR `name`.
- Success: `200 OK` -> `UserDto[]`
- Error: `400` when `q` omitted (to prevent listing all users)

Notes: Frontend must always include `q` when calling this endpoint.

### GET /api/users/me
- Auth: required
- Success: `200 OK` -> `UserDto` (current user)

### GET /api/users/{id}
- Auth: optional
- Success: `200 OK` -> `UserDto` (public profile) or `404`

### PUT /api/users/{id}
- Auth: required
- Body: `{ "name": "string?", "password": "string?" }`
- Validation: only owner can update (server returns `403` otherwise)
- Success: `204 No Content`

### DELETE /api/users/{id}
- Auth: required
- Only owner may delete; `204` on success

---

## 3) Devices

> Devices are private — users can operate only on their own device tokens.

### POST /api/devices
- Auth: required
- Body: `{ "deviceToken": "string", "platform": "string" }`
- Behavior: creates or updates a `UserDevice`. If token exists for another user, it is reassigned to current user.
- Success: `201 Created` -> `DeviceDto`

### GET /api/devices
- Auth: required
- Returns: devices belonging to current user only.

### GET /api/devices/{id}
- Auth: required
- Only returns device if owned by current user (otherwise `404`).

### DELETE /api/devices/{id}
- Auth: required
- Deletes device if owned by current user; `204`.

---

## 4) FreeTimes

> `FreeTimeDto` contains `UserName` — frontend can display readable names.

### GET /api/freetimes?userId={id}
- Auth: required
- If `userId` omitted -> returns current user's freetimes.
- If `userId` != current -> visible only if current user and target are friends -> otherwise `403`.
- Success: `200 OK` -> `FreeTimeDto[]`

### GET /api/freetimes/{id}
- Auth: required
- Returns single `FreeTimeDto` (includes `UserName`), or `404`.

### POST /api/freetimes
- Auth: required
- Body: `{ "startTime": "ISO8601?", "endTime": "ISO8601?" }`
- Defaults: `startTime` => now; `endTime` => end of day (midnight) if omitted.
- Creates FreeTime for current user. Returns `201` with `FreeTimeDto`.

### POST /api/freetimes/imfree
- Auth: required
- No body. Creates FreeTime from now until midnight for current user. Returns `201` with `FreeTimeDto`.

### PUT /api/freetimes/{id}
- Auth: required
- Only owner can update -> otherwise `403`.
- Body same as POST. Success `204`.

### DELETE /api/freetimes/{id}
- Auth: required
- Only owner can delete. Success `204`.

---

## 5) Friend suggestions (requests)

> All suggestion DTOs include both ID and display name to help frontend rendering.

### POST /api/friendsuggestions
- Auth: required
- Body: integer `suggestedId` (plain integer in body)
- Creates friend request. `201` -> `FriendSuggestionDto` (IDs + names)
- Errors: `400` self-request, `409` already exists

### GET /api/friendsuggestions/outgoing
- Auth: required
- Lists suggestions created by current user. `200` -> `FriendSuggestionDto[]`

### GET /api/friendsuggestions/incoming
- Auth: required
- Lists suggestions where current user is suggested. `200` -> `FriendSuggestionDto[]`

### POST /api/friendsuggestions/accept
- Auth: required
- Body: integer `suggesterId`
- Only suggested user may accept (server enforces). Creates `FriendPair` and removes the suggestion. Returns `201` -> `FriendPairDto`.
- If already friends -> `409` (suggestion removed by server)

### POST /api/friendsuggestions/reject
- Auth: required
- Body: integer `suggesterId`
- Only suggested user may reject. `204` No Content on success

### DELETE /api/friendsuggestions?suggesterId=X&suggestedId=Y
- Auth: required
- Either party may remove the suggestion. `204`.

---

## 6) Friend pairs (confirmed friendships)

### POST /api/friendpairs
- Auth: required
- Body: integer `otherUserId`
- Creates confirmed friendship (normalizes order). Returns `201` -> `FriendPairDto` (with names).
- Errors: `400` self, `409` already friends

### GET /api/friendpairs
- Auth: required
- Returns confirmed friend pairs where current user is participant. `200` -> `FriendPairDto[]`

### DELETE /api/friendpairs?friend1Id=X&friend2Id=Y
- Auth: required
- Only participants may remove. `204` on success.

---

## 7) Products (sample)
- Keep as reference; not critical for frontend core flows.

---

## Access rules (shrnutí pro frontend)
- Always send `Authorization` header for protected endpoints.
- Searching users must include `q` (prevents listing all users).
- Users may only modify/delete their own profile.
- Devices are private to owners — do not request other users' devices.
- FreeTimes of other users are visible only to friends.
- Friend DTOs include names — frontend should rely on them instead of additional user lookups.

---

## Examples (end‑to‑end)
1) Register & login:
```
curl -X POST http://localhost:5135/api/auth/register -H "Content-Type: application/json" -d '{"username":"alice","password":"pass","name":"Alice"}'
curl -X POST http://localhost:5135/api/auth/login -H "Content-Type: application/json" -d '{"username":"alice","password":"pass"}'
```

2) Send friend request (assume TOKEN):
```
curl -X POST http://localhost:5135/api/friendsuggestions -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "3"
```

3) Accept friend request (suggested user):
```
curl -X POST http://localhost:5135/api/friendsuggestions/accept -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "2"
```

---

## TODO / doporučení pro další kroky
- Přidat paging/limit/offset pro list endpointy.
- Rozšířit Swagger dokumentaci příklady (OpenAPI request/response examples).
- Přidat integration tests pro auth + friendflow.

---

## Push notifikace

- Implementace: background queue (`NotificationQueue`) + worker (`NotificationBackgroundService`) zpracovává frontu.
- Poskytovatel: FCM (Firebase) je podporován přes legacy `serverKey` v konfiguraci `Fcm:ServerKey`.
- Konfigurace (appsettings):

```json
{
  "Fcm": {
    "ServerKey": "<your-fcm-server-key>"
  }
}
```

- Pokud není `Fcm:ServerKey` nastaven, použije se No-op implementace (logování).
- Příklady použití (interně):
  - Po přijetí žádosti o přátelství se posílá notifikace autorovi žádosti.
  - `POST /api/freetimes/imfree` enqueueuje notifikace všem přátelům uživatele.

---

---

*Dokument vytvořen automaticky pomocí interního nástroje vývojového prostředí.*
