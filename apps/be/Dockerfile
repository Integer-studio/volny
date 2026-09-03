FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY SemFre/SemFre.csproj SemFre/
RUN dotnet restore SemFre/SemFre.csproj

COPY SemFre/ SemFre/
RUN dotnet publish SemFre/SemFre.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SemFre.dll"]
