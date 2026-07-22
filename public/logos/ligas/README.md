# Official league logo drop-zone

Drop the **official** league logos here to have them appear automatically
across the `/ligas-invernales` surface. No code changes are required.

## Filenames (exact)

| League                                   | Slug    | File to add           |
| ---------------------------------------- | ------- | --------------------- |
| Liga Mexicana del Pacífico               | `lmp`   | `lmp.svg`  (or `.png`) |
| Liga Venezolana de Béisbol Profesional   | `lvbp`  | `lvbp.svg` (or `.png`) |
| Liga Dominicana de Béisbol (LIDOM)       | `lidom` | `lidom.svg`(or `.png`) |
| Liga Roberto Clemente (Puerto Rico)      | `lbprc` | `lbprc.svg`(or `.png`) |
| Serie del Caribe                         | `sdc`   | `sdc.svg`  (or `.png`) |

Prefer **SVG**; fall back to a high-resolution transparent **PNG**.

## Then wire it in

Set the `logo` field for that league in
`src/components/ligas/leagues.ts`, e.g.:

```ts
{
  slug: "lmp",
  // ...
  logo: "/logos/ligas/lmp.svg",
},
```

`<LeagueLogo>` renders the official file when `logo` is set, and otherwise
falls back to the original house-style `<LeagueMark>`.

## Why the folder ships empty

The official logos could not be fetched from this environment: the session's
network egress policy blocks Wikipedia/Wikimedia and the leagues' own sites.
The logos must therefore be supplied directly (from the brand/media packs) or
fetched from an environment with broader egress.

> These marks are third-party trademarks. This drop-zone is intended for
> pitch/presentation mockups shown to the league authorities, not for
> production distribution.
