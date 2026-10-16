// Mission Operator OpenStreetMap relay
// One endpoint for cell masts, rail stations, portals and ports.
// Snaps the point to a grid so nearby players share one cached Overpass answer.

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const KINDS = {
  cell: { d: 0.4, grid: 0.25, ttl: 3600, limit: 40, q: (b) => `node["man_made"="mast"](${b});node["tower:type"="communication"](${b});` },
  rail: { d: 1.0, grid: 0.5, ttl: 21600, limit: 40, q: (b) => `node["railway"="station"](${b});node["railway"="halt"](${b});` },
  portal: { d: 0.04, grid: 0.02, ttl: 21600, limit: 60, q: (b) => `node["tourism"~"artwork|attraction|museum|viewpoint"]["name"](${b});node["historic"]["name"](${b});node["amenity"~"place_of_worship|library|fountain"]["name"](${b});` },
  port: { d: 2.0, grid: 1.0, ttl: 86400, limit: 30, q: (b) => `node["harbour"](${b});node["seamark:type"="harbour"](${b});way["landuse"="port"](${b});way["industrial"="port"](${b});` },
};

function snap(v, g) {
  return Math.round(v / g) * g;
}

module.exports = async function handler(req, res) {
  const kind = KINDS[req.query.kind];
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!kind || !isFinite(lat) || !isFinite(lon)) {
    res.status(400).json({ error: "kind, lat and lon required", items: [] });
    return;
  }
  const sLat = +snap(lat, kind.grid).toFixed(3);
  const sLon = +snap(lon, kind.grid).toFixed(3);
  const d = kind.d;
  const bbox = `${sLat - d},${sLon - d},${sLat + d},${sLon + d}`;
  const query = `[out:json][timeout:20];(${kind.q(bbox)});out center ${kind.limit * 3};`;

  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "mission-operator" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const items = (data.elements || [])
        .map((e) => ({
          id: e.type + e.id,
          name: (e.tags && (e.tags.name || e.tags.operator)) || "",
          lat: e.lat != null ? e.lat : e.center && e.center.lat,
          lon: e.lon != null ? e.lon : e.center && e.center.lon,
        }))
        .filter((e) => typeof e.lat === "number" && typeof e.lon === "number")
        .slice(0, kind.limit);
      res.setHeader("Cache-Control", `public, s-maxage=${kind.ttl}, stale-while-revalidate=${kind.ttl}`);
      res.status(200).json({ kind: req.query.kind, cell: [sLat, sLon], items });
      return;
    } catch (e) {
      // try the next mirror
    }
  }
  res.setHeader("Cache-Control", "public, s-maxage=60");
  res.status(502).json({ error: "feed unavailable", items: [] });
};
