# Paizo material

This project uses Paizo's trademarks and optional official artwork under the
[Paizo Community Use Policy](https://paizo.com/licenses/communityuse) (CUP). This page explains how, so that
contributors and people who fork or host the project stay within it. It is a summary, not legal advice; the policy
itself and its [FAQ](https://paizo.com/community/communityuse/faq) are what count.

## What the policy allows and requires (summary)

- Free, non-commercial fan projects may use the contents of the
  [Community Use Package](https://paizo.com/licenses/communityuse/package), product cover images, blog art, and
  descriptive references to Paizo trademarks, characters and places.
- Everything must be free to access: no paywalls, sign-up walls or charges. Donations and ads are allowed.
- Art not in the package, blog or product covers may not be used. Logos may not be altered (grayscale only for
  black-and-white works).
- The project must carry the Community Use notice (it is in the site footer, the README, and every infographic with
  attribution on) and current contact information.
- Images should be hosted by the project, not hotlinked from Paizo's servers.

## How this repository handles it

- **No Paizo files in git.** The repository contains no Paizo artwork, logos or copied rules text. `local-assets/`
  is git-ignored.
- **Users fetch the art themselves.** `./pfsf.sh fetch-art` / `pfsf.bat fetch-art` / `bun run paizo:fetch`
  download the portrait zips listed in each `game.json` (`artPacks`) into `local-assets/paizo/`. In the web app,
  users download the zip from Paizo and drop it in; it stays in their browser.
- **The GitHub Pages build does not include official art.** It only ships our own emblems, which is why the web app
  asks users to supply the zip.
- **Class text is our own.** Summaries are written for this project in our own words; game mechanics are described,
  not quoted.

Official portraits currently referenced:

| Pack | Download | Contents |
| --- | --- | --- |
| Pathfinder 2e Iconic Heroes | [Pathfinder_Second_Edition_Iconic_Heroes_Portraits.zip](https://downloads.paizo.com/Pathfinder_Second_Edition_Iconic_Heroes_Portraits.zip) (~31 MB) | 27 portraits by Wayne Reynolds, JPG and transparent PNG |
| Starfinder 2e Iconic Heroes | [Starfinder_Second_Edition_Iconic_Heroes_Portraits.zip](https://downloads.paizo.com/Starfinder_Second_Edition_Iconic_Heroes_Portraits.zip) (~45 MB) | 6 portraits by Kent Hamilton, JPG and transparent PNG |

The rest of the package (logos, maps, organization, regional and religious symbols) is not used by the infographic.

## Classes without a Community Use portrait

As of September 2026 the package has no portraits for the Pathfinder **runesmith** (Pallemi) and **necromancer**
(Usharak), the **daredevil** and **slayer** playtests, or the Starfinder **mechanic** (Quig), **technomancer** (Raia)
and **luminary** (Prisma). Those cards use our emblems.

You can supply your own images in `local-assets/art/<game>/<class-id>.png` (or drop them into the web app). Keep in
mind that the Community Use Policy only covers art from the package, the Paizo blog and product covers. Art taken
from other Paizo products (for example pregenerated character sheets) is fine on your own computer, but an image you
**share** that contains it is outside the policy.

## If you host a fork

- Keep the Community Use notice and your contact information on the site.
- Don't charge for access.
- If you decide to bundle the Community Use Package art into your own deployment (the policy prefers you host it
  yourself over hotlinking), keep it to package contents, credit the artists, and do not commit it to a public
  repository that others would redistribute under our open licenses.
