# Konvence — `apps/be`

Backend (`SemFre`) je ASP.NET Core API v C#, nasazovaný jako kontejner na
Azure Container Apps.

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
