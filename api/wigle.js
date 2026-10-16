// Mission Operator WiGLE relay for Wi-Fi and Bluetooth
// Needs the WIGLE_AUTH environment variable in Vercel: the "Encoded for use" value
// from the WiGLE account API page. Cached for a day per small grid cell to protect the quota.

function snap(v) {
  return Math.round(v * 200) / 200;
}

module.exports = async function handler(req, res) {
  const auth = process.env.WIGLE_AUTH;
  if (!auth) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.status(200).json({ error: "key", missing: "WIGLE_AUTH" });
    return;
  }
  const type = req.query.type === "bt" ? "bt" : "wifi";
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!isFinite(lat) || !isFinite(lon)) {
    res.status(400).json({ error: "lat and lon required" });
    return;
  }
  const sLat = snap(lat);
  const sLon = snap(lon);
  const d = 0.006;
  const range = `latrange1=${(sLat - d).toFixed(4)}&latrange2=${(sLat + d).toFixed(4)}&longrange1=${(sLon - d).toFixed(4)}&longrange2=${(sLon + d).toFixed(4)}`;
  const path = type === "bt" ? "bluetooth/search" : "network/search";
  try {
    const r = await fetch(`https://api.wigle.net/api/v2/${path}?${range}&resultsPerPage=100`, {
      headers: { Authorization: "Basic " + auth, Accept: "application/json" },
    });
    const data = await r.json();
    if (!r.ok || data.success === false) {
      res.setHeader("Cache-Control", "public, s-maxage=300");
      res.status(200).json({ error: "upstream", message: data.message || "WiGLE refused", items: [] });
      return;
    }
    const items = (data.results || [])
      .filter((n) => typeof n.trilat === "number" && typeof n.trilong === "number")
      .map((n) => ({ id: n.netid, name: n.ssid || n.name || (type === "bt" ? "BT DEVICE" : "HIDDEN"), lat: n.trilat, lon: n.trilong }));
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
    res.status(200).json({ type, cell: [sLat, sLon], items });
  } catch (e) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.status(502).json({ error: "feed unavailable", items: [] });
  }
};
