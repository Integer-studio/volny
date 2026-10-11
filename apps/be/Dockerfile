# SDK stage runs natively on the build machine and cross-compiles for the
# target arch (VPS is arm64) - no QEMU emulation of the whole .NET build.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /src

COPY SemFre/SemFre.csproj SemFre/
RUN dotnet restore SemFre/SemFre.csproj -a $TARGETARCH

COPY SemFre/ SemFre/
RUN dotnet publish SemFre/SemFre.csproj -c Release -a $TARGETARCH -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SemFre.dll"]
