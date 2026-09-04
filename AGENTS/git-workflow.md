# Git a PR workflow

V repozitáři zatím neexistuje formální `CONTRIBUTING.md` ani vynucený commit
lint, takže platí tato základní pravidla, dokud nebudou nahrazena něčím
podrobnějším.

## Větve

- Nový branch pojmenuj popisně podle toho, co dělá (např.
  `feature/pridani-pratel`, `fix/expo-crash-na-androidu`).
- Změny týkající se jen jedné aplikace drž v rámci `apps/fe` nebo `apps/be`
  — CI je stejně spouští odděleně podle cesty, takže míchání zbytečně
  rozšiřuje diff a riziko konfliktů.

## Commity

- Commit message piš tak, aby vysvětlovala *proč* se změna dělá, ne jen co
  se změnilo (to už ukazuje diff).
- Menší, tematicky uzavřené commity jsou lepší než jeden velký commit se
  vším.
- Necommituj vygenerované/build artefakty ani `.env` soubory se secrets.

## Pull requesty

- PR popis by měl shrnout změnu a jak ji ověřit (co spustit, co zkontrolovat
  v appce).
- Pokud PR souvisí s úkolem z [task trackeru](./tasks/README.md), odkaž na
  příslušný soubor úkolu.
- Před otevřením PR zkontroluj, že CI pro dotčenou aplikaci prochází.
