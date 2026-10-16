// Mission Operator weather relay
// National Weather Service stations near the player with their latest observation.
// US coverage only. Cached for ten minutes per grid cell.

function snap(v) {
  return Math.round(v * 4) / 4;
}

const H = { "User-Agent": "mission-operator (weather layer)", Accept: "application/geo+json" };

module.exports = async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!isFinite(lat) || !isFinite(lon)) {
    res.status(400).json({ error: "lat and lon required", items: [] });
    return;
  }
  const sLat = snap(lat);
  const sLon = snap(lon);
  try {
    const p = await fetch(`https://api.weather.gov/points/${sLat.toFixed(4)},${sLon.toFixed(4)}`, { headers: H });
    if (!p.ok) throw new Error("points " + p.status);
    const pd = await p.json();
    const st = await fetch(pd.properties.observationStations, { headers: H });
    const sd = await st.json();
    const stations = (sd.features || []).slice(0, 8);
    const items = await Promise.all(stations.map(async (s) => {
      const sid = s.properties.stationIdentifier;
      const c = s.geometry.coordinates;
      const base = { id: sid, name: s.properties.name, lat: c[1], lon: c[0], tempF: null, wind: null, humidity: null, desc: "" };
      try {
        const o = await fetch(`https://api.weather.gov/stations/${sid}/observations/latest`, { headers: H });
        const op = (await o.json()).properties || {};
        const tc = op.temperature && op.temperature.value;
        base.tempF = tc != null ? Math.round(tc * 9 / 5 + 32) : null;
        base.wind = op.windSpeed && op.windSpeed.value != null ? Math.round(op.windSpeed.value * 0.621371) : null;
        base.humidity = op.relativeHumidity && op.relativeHumidity.value != null ? Math.round(op.relativeHumidity.value) : null;
        base.desc = op.textDescription || "";
      } catch (e) {}
      return base;
    }));
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=900");
    res.status(200).json({ cell: [sLat, sLon], items });
  } catch (e) {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    res.status(200).json({ error: "outside coverage", items: [] });
  }
};
