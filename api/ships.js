// Mission Operator ship relay
// Opens the AISstream socket on the server for a few seconds, collects position reports,
// closes it, and caches the result so the key never reaches the browser.
// Needs the AISSTREAM_KEY environment variable in Vercel.

function snap(v) {
  return Math.round(v * 2) / 2;
}

module.exports = async function handler(req, res) {
  const key = process.env.AISSTREAM_KEY;
  if (!key) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.status(200).json({ error: "key", missing: "AISSTREAM_KEY" });
    return;
  }
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (!isFinite(lat) || !isFinite(lon)) {
    res.status(400).json({ error: "lat and lon required" });
    return;
  }
  if (typeof WebSocket === "undefined") {
    res.status(500).json({ error: "runtime has no WebSocket" });
    return;
  }
  const sLat = snap(lat);
  const sLon = snap(lon);
  const d = 1.5;
  const ships = {};

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { ws.close(); } catch (e) {}
      resolve();
    };
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    const timer = setTimeout(finish, 7000);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        APIKey: key,
        BoundingBoxes: [[[sLat - d, sLon - d], [sLat + d, sLon + d]]],
        FilterMessageTypes: ["PositionReport"],
      }));
    };
    ws.onmessage = async (ev) => {
      try {
        const text = typeof ev.data === "string" ? ev.data : await new Response(ev.data).text();
        const m = JSON.parse(text);
        const md = m.MetaData || {};
        const pr = (m.Message && m.Message.PositionReport) || {};
        const id = md.MMSI || pr.UserID;
        if (!id) return;
        ships[id] = {
          id: id,
          name: (md.ShipName || "").trim() || "MMSI " + id,
          lat: md.latitude != null ? md.latitude : pr.Latitude,
          lon: md.longitude != null ? md.longitude : pr.Longitude,
          heading: pr.TrueHeading != null && pr.TrueHeading < 360 ? pr.TrueHeading : pr.Cog || 0,
          speed: pr.Sog || 0,
        };
        if (Object.keys(ships).length >= 80) { clearTimeout(timer); finish(); }
      } catch (e) {}
    };
    ws.onerror = () => { clearTimeout(timer); finish(); };
    ws.onclose = () => { clearTimeout(timer); finish(); };
  });

  const list = Object.values(ships).filter((s) => typeof s.lat === "number" && typeof s.lon === "number");
  res.setHeader("Cache-Control", "public, s-maxage=90, stale-while-revalidate=180");
  res.status(200).json({ cell: [sLat, sLon], ships: list });
};
