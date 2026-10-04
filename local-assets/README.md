# local-assets/ (not committed)

Everything in this folder except this README is ignored by git. It holds artwork that this project is **not**
allowed to redistribute but that you may use locally under Paizo's Community Use Policy.

```
local-assets/
  paizo/                 Community Use Package zips, exactly as downloaded from Paizo
    Pathfinder_Second_Edition_Iconic_Heroes_Portraits.zip
    Starfinder_Second_Edition_Iconic_Heroes_Portraits.zip
  art/
    pf2e/<class-id>.png  Extra images for classes the package does not cover (e.g. runesmith.png)
    sf2e/<class-id>.png
```

- `./pfsf.sh fetch-art` (or `pfsf.bat fetch-art`, or `bun run paizo:fetch`) downloads the zips.
- Images in `art/` override the package for the same class. Use PNGs with transparent backgrounds.
- The local GUI (`start.sh` / `start.bat`) and the CLI (`--art paizo`) pick these up automatically.

See [docs/paizo-assets.md](../docs/paizo-assets.md) for what may and may not be shared.
