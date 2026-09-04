# Expo Router Example

Use [`expo-router`](https://docs.expo.dev/router/introduction/) to build native navigation using files in the `app/` directory.

## Launch your own

[![Launch with Expo](https://github.com/expo/examples/blob/master/.gh-assets/launch.svg?raw=true)](https://launch.expo.dev/?github=https://github.com/expo/examples/tree/master/with-router)

## 🚀 How to use

```sh
npx create-expo-app -e with-router
```

## Deploy

Deploy on all platforms with Expo Application Services (EAS).

- Deploy the website: `npx eas-cli deploy` — [Learn more](https://docs.expo.dev/eas/hosting/get-started/)
- Deploy on iOS and Android using: `npx eas-cli build` — [Learn more](https://expo.dev/eas)

## 📝 Notes

- [Expo Router: Docs](https://docs.expo.dev/router/introduction/)

# Todos

- [x] fix FE
- [x] detail profilu pri kliknuti (popup) - bude obsahovat kontakt a friend add/remove - moznost rozkliknuti pouze ze skupiny nebo listu volnych lidi
- [x] qr ve skupine
- [x] citelne slugs pro invite do skupiny
- [x] linky a qr pro pridavani lidi jako friends
- [ ] implementovat sockety (volni lide, friend requests)
- [ ] zjistit stav oznameni, i na webu
- [x] APK prihlaseni fail
- [ ] Moc velke apk

## Konfigurace API URL

`EXPO_PUBLIC_API_URL` je inlinovaná Babel proměnná - musí být nastavená v čase buildu.
`eas.json` ji nastavuje pro každý profil (`development` → localhost, `preview`/`production` →
produkční Container App). Fallback v `lib/config.ts` je záměrně produkční URL, ne localhost -
build bez nastavené env nesmí tiše mířit na localhost (přesně tak vznikl výše zmíněný bug).

Pro lokální vývoj proti `dotnet run` (port 5135) zkopíruj `.env.local.example` do `.env.local`.
