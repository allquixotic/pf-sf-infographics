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

## Necromancer and Runesmith portraits

Checked 2026-10-04: Paizo’s [Remaster pregen archive](https://downloads.paizo.com/PathfinderSecondEditionRemasteredPregens.zip)
contains Pallemi (Runesmith) and Usharak (Necromancer), including their Level 5 PDFs updated September 11, 2026.
The sheets carry Paizo copyright and permission to photocopy for personal use only (Pallemi’s footer says ©2025;
Usharak’s says ©2026). No Creative Commons or open artwork license appears in those PDFs. A rules license such
as ORC does not itself license the illustrations. Do not describe the portraits as Apache, CC BY, or ORC artwork,
or infer a broad extraction/redistribution license merely because the pregen download is free.

There is a clearer independent source for these portraits: Paizo published them in its official blog, credited to
**Wayne Reynolds**:

- [Meet the Iconics: Usharak](https://paizo.com/blog/meet-the-iconics-usharak) — Necromancer.
- [Meet the Iconics: Pallemi](https://paizo.com/blog/meet-the-iconics-pallemi), June 18, 2026 — Runesmith.

The [Community Use Policy](https://paizo.com/licenses/communityuse), updated August 22, 2024, permits eligible
Paizo blog artwork in qualifying free, non-commercial community projects, subject to its exclusions and conditions.
These illustrated character posts provide a CUP route independent of the narrower notice printed on the sheets.
This is conditional permission from Paizo, not an open-source artwork license. Retain copyright, artist credits,
and the Community Use notice when distributing an infographic containing these portraits.

In the web app, choose **Official / custom art**, expand **Necromancer & Runesmith portraits**, and:

1. Open the relevant Paizo post, open its portrait, and save the image locally.
2. Rename the image to `necromancer` or `runesmith`, retaining the actual extension (for example `.png`, `.jpg`,
   or `.webp`). A rename does not convert an image’s format.
3. Check **My next uploads are Wayne Reynolds / Paizo portraits (include credits)**, then upload those images,
   individually or in a ZIP. Uncheck it before uploading unrelated custom artwork.
4. Keep **Credits & notices** enabled when sharing. The upload’s credit flag is saved with the artwork and
   restored on reload. The output also includes an artist/copyright line when the legend is hidden.

No PDF extraction is required and this repository still distributes no Paizo images. If you already uploaded
these portraits as ordinary custom art, upload them again with the credit checkbox selected.

The standard portrait ZIP still lacks these two images. The Pathfinder daredevil/slayer playtests and Starfinder
mechanic/technomancer/luminary also fall back to emblems unless supplied with suitable images. For any other
artwork, check whether its particular source is covered by the CUP or obtain separate permission; do not assume
all pregen art is prohibited or that every freely downloadable Paizo image is covered.

## Custom artwork

Choose **Official / custom art** in the web app, then drop in images or a ZIP. Name images after the class ID or
name, for example `animist.png`, `Witchwarper.svg`, or `Fighter - Portrait.jpg`. PNG, JPG/JPEG, SVG, WebP and GIF
are supported. Nested folders, capitalization, accents and common separators are tolerated; hidden files and
macOS archive metadata are ignored. Animated formats are rendered as still images.

Exact class filenames take priority over filenames with extra descriptive words. If multiple versions match,
the format preference is PNG, SVG, WebP, JPEG, then GIF. Loose uploaded images override custom ZIPs; later custom
ZIPs override earlier ones. Custom images apply to the selected game and override its official portraits.
Missing artwork uses the bundled emblem. Select **Emblems** to return to the bundled symbols.

Settings and uploaded archives remain in this browser when storage is available; they are never sent to a server.
Use **Forget supplied art** to remove stored uploads. For the CLI, place images or ZIPs in
`local-assets/art/pf2e/` or `local-assets/art/sf2e/` and use `--art paizo`.

## If you host a fork

- Keep the Community Use notice and your contact information on the site.
- Don't charge for access.
- If you decide to bundle the Community Use Package art into your own deployment (the policy prefers you host it
  yourself over hotlinking), keep it to package contents, credit the artists, and do not commit it to a public
  repository that others would redistribute under our open licenses.
