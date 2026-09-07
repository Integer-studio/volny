# Konvence — `apps/be`

Backend (`SemFre`) je ASP.NET Core API v C#, nasazovaný jako kontejner na
Azure Container Apps.

## Cílená verze .NET

Projekt cílí na **.NET 10 (LTS)** — `TargetFramework` v
`SemFre/SemFre.csproj` i base images v `Dockerfile`
(`sdk:10.0`/`aspnet:10.0`) musí zůstat sesynchronizované. .NET vydává LTS
verze u sudých čísel (6, 8, 10 - podpora 3 roky) a STS u lichých (7, 9 -
podpora ~18 měsíců); pro produkční backend na Azure Container Apps je LTS
bezpečnější volba. Balíčky (EF Core, JwtBearer) zůstávají na `8.0.12` -
fungují beze změny i na novějším TargetFrameworku, není potřeba je bumpovat
spolu s frameworkem.

Historie migrací TargetFrameworku (2026-09-07): .NET 9 → .NET 8 → .NET 10.
Prvních dvou kroků byl důvod stejný (LTS místo STS), přechod na .NET 10 byl
jen o krok dál - je to novější LTS se stejnou zárukou podpory a delším
zbývajícím support oknem než .NET 8.

Při lokálním vývoji potřebuješ nainstalovaný .NET 10 SDK i ASP.NET Core 10
runtime + targeting pack (`dotnet --list-sdks`); na Arch Linuxu
`sudo pacman -S dotnet-sdk-10.0 aspnet-runtime-10.0
aspnet-targeting-pack-10.0`.

Repozitář zatím nemá vlastní `.editorconfig` ani vynucený style guide, takže
se drž standardních konvencí ASP.NET Core/.NET, dokud nebude řečeno jinak:

- Pojmenování podle .NET konvencí (PascalCase pro veřejné členy a typy,
  camelCase pro lokální proměnné a parametry).
- Nová funkcionalita by měla navazovat na existující strukturu řešení
  (`SemFre.sln`) — kontrolery, služby a modely dávej vedle podobných
  existujících tříd, ne do nových ad-hoc adresářů.
- Konfigurace a secrets patří do konfiguračního systému ASP.NET Core
  (`appsettings*.json` + proměnné prostředí), ne natvrdo do kódu.
- Změny v API kontraktu (routy, DTO) zvaž z pohledu `apps/fe`, který na
  backend přímo volá — nekompatibilní změna bez koordinace rozbije frontend.
