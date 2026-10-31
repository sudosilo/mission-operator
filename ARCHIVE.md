# SEALED — ARCHIVED 2026-10-30

```
                        +---------------------------+
                        |                           |
                        |     M I S S I O N         |
                        |     O P E R A T O R       |
                        |                           |
                        |        CLOSED             |
                        |     2026-10-30            |
                        |                           |
                        |   superseded by           |
                        |   F I E L D   T W I N     |
                        |                           |
                        +---------------------------+
```

**This repository is archived. It is read-only. No further work happens here.**

---

## Why

Mission Operator and Field Twin grew toward each other. They were built separately, for
different jobs — one watched the air and the airwaves, the other recorded where a truck
went and what it cost. But over months they ended up wanting the same things: a map, a
device location, a log of what happened, a place to keep it all.

When two pieces of software get that close, they can stop being two things. They produce a
third thing. And that third thing is usually better than either parent, because it was
never asked to be either of them — it only had to be the one thing the work actually
needed.

That is what happened here. Field Twin is that third thing.

So Mission Operator is not being shut off because it failed. It is being retired the way a
good tool gets retired: something arrived that does the job better, and keeping both alive
would mean splitting attention and maintenance across two codebases that were already
converging. The right number of field apps to maintain is one.

Anyone reading this in a year: this was not abandonment. This was succession.

## What Field Twin replaced it with

- **The map.** Field Twin's Field map is the map Mission Operator was building toward.
- **Device location.** Both needed it. Field Twin now runs it on a real phone app with GPS
  tracking that survives being parked.
- **The log.** Mission Operator had a logbook. Field Twin has a day log with stops, miles,
  receipts, search, spend totals and end-of-day debriefs — the logbook, finished.
- **Road context.** Mission Operator watched the airspace for things nearby. Field Twin
  watches the road for things nearby: cameras, hazards, crashes, construction. Same
  instinct, better aim.

## What was NOT carried over

This is the honest part, and it is worth writing down plainly rather than letting the seal
imply a clean handoff.

Mission Operator scanned things Field Twin does not scan. These layers have **no equivalent
in Field Twin** and are retired with this repo:

- Aircraft, via the ADS-B mirrors in `api/aircraft.js`
- Ships and AIS, via `api/ships.js` (needs `AISSTREAM_KEY`)
- GPS satellites, weather satellites, debris and rocket bodies, via `api/sats.js` (needs `N2YO_KEY`)
- Wi-Fi and Bluetooth access points, via `api/wigle.js` (needs `WIGLE_AUTH`)
- Cell towers, ham repeaters, Meshtastic and Helium nodes, rail stations, portals and ports,
  via `api/osm.js` and `api/mesh.js`

If any of that turns out to be wanted later, the relay code still works and is still here,
frozen at this commit. It is a starting point, not a dead end. Nothing was deleted.

## Operational state at the moment of sealing

- **GitHub repo:** archived, read-only
- **Vercel project `mission-operator`:** left deployed, no environment variables, never had any.
  The three keyed layers (`sats`, `ships`, `wigle`) have always answered `{"error":"key"}`
  because those keys were never supplied. That is not a regression — it was always so.
- **The `mission-operator-next` rebuild:** separate repo, separate Vercel project, built on
  Redis instead of nothing. Its fate is a separate decision and is not settled by this seal.
- **Control Troll:** stop checking this app. It is no longer a live surface to test.

## If you are unsealing this

You probably want one of the scanner layers back. Read `api/_keys`-adjacent files first, get
the key, and check whether Field Twin has since grown the layer. If it has, add it there
instead of here. Two field apps was already one too many.
