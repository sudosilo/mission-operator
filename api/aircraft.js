// Mission Operator v2026.10.15 aircraft relay
// Snaps the requested point to a grid cell so nearby requests share one cached answer,
// then lets the Vercel edge cache serve repeats instead of calling the upstream feed again.

const SOURCES = [
  (lat, lon, nm) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${nm}`,
  (lat, lon, nm) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${nm}`,
];

function snap(v) {
  return Math.round(v * 4) / 4;
}

module.exports = async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  let nm = parseInt(req.query.nm, 10);
  if (!isFinite(lat) || !isFinite(lon)) {
    res.status(400).json({ error: "lat and lon required" });
    return;
  }
  if (!isFinite(nm) || nm < 10) nm = 60;
  if (nm > 250) nm = 250;

  const sLat = snap(lat);
  const sLon = snap(lon);

  for (const build of SOURCES) {
    try {
      const r = await fetch(build(sLat, sLon, nm), { headers: { "User-Agent": "mission-operator" } });
      if (!r.ok) continue;
      const data = await r.json();
      const list = (data.ac || data.aircraft || [])
        .filter(a => typeof a.lat === "number" && typeof a.lon === "number")
        .map(a => ({
          icao: a.hex,
          callsign: (a.flight || a.r || a.hex || "").trim(),
          lat: a.lat,
          lon: a.lon,
          alt: a.alt_baro === "ground" ? 0 : (typeof a.alt_baro === "number" ? a.alt_baro : (a.alt_geom || 0)),
          heading: a.track || a.true_heading || 0,
          type: a.t || "",
        }));
      res.setHeader("Cache-Control", "public, s-maxage=12, stale-while-revalidate=30");
      res.status(200).json({ cell: [sLat, sLon], nm, aircraft: list });
      return;
    } catch (e) {
      // try the next source
    }
  }
  res.setHeader("Cache-Control", "public, s-maxage=30");
  res.status(502).json({ error: "feed unavailable", aircraft: [] });
};
