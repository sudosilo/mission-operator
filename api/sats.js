// Mission Operator satellite relay
// One N2YO call for everything overhead, sorted here into Starlink, GPS, weather,
// debris and rocket bodies. Five layers cost one upstream call per grid cell.
// Needs the N2YO_KEY environment variable in Vercel.

function snap(v) {
  return Math.round(v);
}

const WEATHER = /^(NOAA|GOES|METEOR|METOP|FENGYUN|FY-|HIMAWARI|DMSP|SUOMI|JPSS|ELEKTRO|GCOM|AQUA|TERRA)/;

function classify(name) {
  const n = (name || "").toUpperCase();
  if (n.indexOf("STARLINK") === 0) return "starlink";
  if (n.indexOf(" DEB") > -1 || n.indexOf("DEB ") === 0 || n.indexOf("DEBRIS") > -1) return "debris";
  if (n.indexOf("R/B") > -1) return "rocket";
  if (n.indexOf("NAVSTAR") === 0 || n.indexOf("GPS ") === 0) return "gps_sat";
  if (WEATHER.test(n)) return "weather_sat";
  return null;
}

module.exports = async function handler(req, res) {
  const key = process.env.N2YO_KEY;
  if (!key) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.status(200).json({ error: "key", missing: "N2YO_KEY" });
    return;
  }
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!isFinite(lat) || !isFinite(lon)) {
    res.status(400).json({ error: "lat and lon required" });
    return;
  }
  const sLat = snap(lat);
  const sLon = snap(lon);
  try {
    const r = await fetch(`https://api.n2yo.com/rest/v1/satellite/above/${sLat}/${sLon}/0/70/0/&apiKey=${key}`);
    if (!r.ok) throw new Error("upstream " + r.status);
    const data = await r.json();
    const out = { starlink: [], debris: [], rocket: [], gps_sat: [], weather_sat: [] };
    (data.above || []).forEach((s) => {
      const k = classify(s.satname);
      if (!k || out[k].length >= 120) return;
      out[k].push({ id: s.satid, name: s.satname, lat: s.satlat, lon: s.satlng, alt: Math.round(s.satalt || 0) });
    });
    res.setHeader("Cache-Control", "public, s-maxage=180, stale-while-revalidate=300");
    res.status(200).json({ cell: [sLat, sLon], sats: out });
  } catch (e) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.status(502).json({ error: "feed unavailable" });
  }
};
