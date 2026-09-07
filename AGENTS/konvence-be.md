# Konvence — `apps/be`

Backend (`SemFre`) je ASP.NET Core API v C#, nasazovaný jako kontejner na
Azure Container Apps.

## Cílená verze .NET

Projekt cílí na **.NET 8 (LTS)** — `TargetFramework` v
`SemFre/SemFre.csproj` i base images v `Dockerfile` (`sdk:8.0`/`aspnet:8.0`)
musí zůstat sesynchronizované. .NET 8 má dlouhodobou podporu (LTS, do
listopadu 2026), zatímco .NET 9 je STS s kratším support cyklem — pro
produkční backend je LTS bezpečnější volba. Projekt byl 2026-09-07 zpětně
zmigrován z .NET 9 na .NET 8 (balíčky EF Core/JwtBearer už na 8.0.12 byly,
měnil se jen `TargetFramework` a Dockerfile).

Při lokálním vývoji potřebuješ nainstalovaný .NET 8 SDK
(`dotnet --list-sdks`); na Arch Linuxu `sudo pacman -S dotnet-sdk-8.0
aspnet-runtime-8.0`.

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
