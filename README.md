> ## ARCHIVED 2026-10-30
>
> **Mission Operator is retired.** It has been superseded by
> [Field Twin](https://github.com/sudosilo/field-twin), which does the same job better now
> that the two projects converged.
>
> This repository is read-only. Nothing here is deleted — the relay code still works and
> still stands at this commit if a layer is ever wanted again.
>
> **Read [ARCHIVE.md](ARCHIVE.md) before touching anything.** It explains why, what Field
> Twin replaced, and — importantly — which scanner layers did *not* carry over.

---

Mission Operator

Mission Operator is a field scanner console for anyone curious about what is in the air and on the airwaves nearby.

It asks for the device location, then scans and lists nearby signals by type. Aircraft come from live flight data. Other types include cell towers, Wi-Fi access points, Bluetooth, ham repeaters, Meshtastic and Helium nodes, and rail. A logbook keeps what was found, and a settings panel adjusts the scan.

Live at mission-operator.vercel.app

Checked every morning by Control Troll, an automated test system that loads every app and clicks through its features.

Latest change. 2026-10-15, v2026.10.15. Rebuilt as a single page with a light theme and the tabs moved to the top. Aircraft now come through a cached relay so repeat scans share one upstream call instead of burning the feed. Logbook, badges and settings now work and keep their data on the device. The tire pressure section is gone.

Full history is in CHANGELOG.md.
