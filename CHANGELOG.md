Mission Operator changelog

2026-10-15, v2026.10.15.2. Brought back the full layer set from the original build on a light map: aircraft, ships, ports, cell towers, rail stations, portals, Meshtastic nodes, weather stations, Starlink, GPS satellites, weather satellites, debris and rocket bodies, with Wi-Fi and Bluetooth on the scan button. Every feed now runs through the app's own server with shared caching, keys stay off the phone, and each layer can be switched on or off. Logbook, badges and lifetime totals cover every layer.

2026-10-15, v2026.10.15. Rebuilt as a single page with a light theme and the tabs moved to the top. Aircraft now come through a cached relay so repeat scans share one upstream call instead of burning the feed. Logbook, badges and settings now work and keep their data on the device. The tire pressure section is gone.

2026-03-26, v2026.03.26. First release. A scanner console that uses the device location to list nearby aircraft from live flight data, along with cell towers, Wi-Fi, Bluetooth, ham repeaters, and mesh nodes. Includes a logbook and settings.

2026-10-30. Final entry. Mission Operator is archived and superseded by Field Twin. The two projects converged: both wanted a map, a device location, and a log of what happened, and Field Twin is the version of that idea built for the job people actually do. The repo is sealed read-only at this commit. The aircraft, satellite, ship, Wi-Fi and Bluetooth scanner layers did not carry over to Field Twin; the relay code for them still works and remains here frozen. See ARCHIVE.md. No further releases.
