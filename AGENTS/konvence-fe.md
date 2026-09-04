# Konvence — `apps/fe`

Frontend (`semfre-fe`) je postavený na Expo/React Native, Expo Routeru,
NativeWind (Tailwind) a TypeScriptu. Nasazuje se jako web (Azure Static Web
Apps) i jako mobilní aplikace (EAS Update).

## Expo se změnilo

Než začneš psát kód, přečti si přesnou verzovanou dokumentaci na
https://docs.expo.dev/versions/v57.0.0/ — chování a API se mezi verzemi Expo
výrazně liší a obecné/starší návody mohou být zavádějící.

## Obecné konvence

- Drž se stávající struktury Expo Routeru (souborové routování) — nové
  obrazovky přidávej podle vzoru existujících v `app/` (nebo odpovídajícím
  adresáři), ne jako vlastní řešení routování.
- Stylování přes NativeWind/Tailwind třídy, ne přes ad-hoc `StyleSheet`
  objekty, pokud to není nutné (např. animace, platform-specific hodnoty).
- TypeScript typy piš explicitně tam, kde je inference nejasná; nepoužívej
  `any` jako řešení typové chyby.
- Sdílenou logiku/komponenty dávej do existujících sdílených adresářů místo
  duplikace mezi obrazovkami.
