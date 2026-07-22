# Official team logo drop-zone

Drop the **official** club logos here to have them replace the monogram
badges across the `/ligas-invernales` surface.

## Path convention

```
public/logos/teams/<league>/<team-slug>.svg   (or .png / .jpeg)
```

`<league>` and `<team-slug>` come from `src/components/ligas/teams.ts`.
For example:

```
public/logos/teams/lidom/tigres-licey.svg
public/logos/teams/lbprc/cangrejeros-santurce.png
```

## Then wire it in

Set the `logo` field for that team in `src/components/ligas/teams.ts`:

```ts
{ slug: "tigres-licey", name: "Tigres del Licey", abbr: "LIC",
  logo: "/logos/teams/lidom/tigres-licey.svg" },
```

`<TeamBadge>` renders the official logo when `logo` is set, otherwise a
monogram disc (the `abbr`) tinted in the league accent.

## Sourcing note

Official club logos could not be fetched from this environment (the session
egress policy blocks the leagues' sites, Wikimedia and Brandfetch). Supply
them from the media/brand packs, or run in an environment with open network
egress. These are third-party trademarks — intended here for the pitch to the
league authorities, not production distribution.
