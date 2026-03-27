import { useState, useEffect, useRef } from "react";

const COLORS = {
  green: "#00ff88", greenDim: "rgba(0,255,136,0.27)", greenFaint: "rgba(0,255,136,0.07)",
  amber: "#ffaa00", red: "#ff3355", blue: "#00aaff", purple: "#aa44ff",
  teal: "#00ffdd", orange: "#ff8800", lime: "#44ff00", yellow: "#ffdd00",
  bg: "#050a08", panel: "#080f0b", border: "#1a3025", text: "#a0c8b0", textDim: "#4a7a5a",
};

const SIGNAL_TYPES = [
  { key: "wifi",       label: "WI-FI AP",       pts: "+5–15 PTS", color: COLORS.green,  count: 0 },
  { key: "bt",         label: "BLUETOOTH",       pts: "+5–20 PTS", color: COLORS.blue,   count: 0 },
  { key: "cell",       label: "CELL TOWER",      pts: "+25 PTS",   color: COLORS.amber,  count: 0 },
  { key: "aircraft",   label: "AIRCRAFT",        pts: "+30–80 PTS",color: COLORS.red,    count: 0 },
  { key: "train",      label: "RAIL / TRAIN",    pts: "+20–50 PTS",color: COLORS.purple, count: 0 },
  { key: "meshtastic", label: "MESHTASTIC",      pts: "+40 PTS",   color: COLORS.teal,   count: 0 },
  { key: "helium",     label: "HELIUM NODE",     pts: "+60 PTS",   color: COLORS.orange, count: 0 },
  { key: "ham",        label: "HAM REPEATER",    pts: "+35 PTS",   color: COLORS.lime,   count: 0 },
  { key: "poke",       label: "POKÉSTOP/PORTAL", pts: "+10 PTS",   color: COLORS.yellow, count: 0 },
];

function ScanRing({ delay, cx, cy }) {
  const [r, setR] = useState(20);
  const [opacity, setOpacity] = useState(0.8);
  useEffect(() => {
    let raf;
    const animate = () => {
      const elapsed = (Date.now() + delay) % 3000;
      const t = elapsed / 3000;
      setR(20 + t * 160);
      setOpacity(0.7 * (1 - t));
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [delay]);
  return <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.green} strokeWidth="1" opacity={opacity}/>;
}

export default function App() {
  const [location, setLocation] = useState(null);
  const [aircraft, setAircraft] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [score, setScore] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState("MAP");
  const toastId = useRef(0);
  const seenAircraft = useRef(new Set());

  // Get GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition(
      pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => console.error(err),
      { enableHighAccuracy: true }
    );
  }, []);

  // Poll OpenSky every 15s
  useEffect(() => {
    if (!location) return;
    const fetchAircraft = async () => {
      const { lat, lon } = location;
      const d = 1.0;
      try {
        const res = await fetch(
          `https://opensky-network.org/api/states/all?lamin=${lat-d}&lomin=${lon-d}&lamax=${lat+d}&lomax=${lon+d}`
        );
        const data = await res.json();
        const states = data.states || [];
        const planes = states.map(s => ({
          icao: s[0], callsign: s[1]?.trim() || s[0],
          lon: s[5], lat: s[6], alt: s[7], heading: s[10],
        })).filter(p => p.lat && p.lon);

        // Award points for new aircraft
        planes.forEach(p => {
          if (!seenAircraft.current.has(p.icao)) {
            seenAircraft.current.add(p.icao);
            const pts = p.alt > 10000 ? 30 : p.alt > 3000 ? 55 : 80;
            const id = toastId.current++;
            setScore(s => s + pts);
            setToasts(t => [...t, { id, msg: `AIRCRAFT ${p.callsign}`, pts: `+${pts}`, color: COLORS.red }]);
            setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
          }
        });

        setAircraft(planes);
      } catch (e) { console.error("OpenSky error:", e); }
    };
    fetchAircraft();
    const iv = setInterval(fetchAircraft, 15000);
    return () => clearInterval(iv);
  }, [location]);

  const triggerScan = () => {
    if (scanning) return;
    setScanning(true);
    setTimeout(() => setScanning(false), 1800);
  };

  const cx = 190, cy = 155;

  // Map aircraft to SVG coords
  const mapToSVG = (lat, lon) => {
    if (!location) return null;
    const scale = 150;
    const x = cx + (lon - location.lon) * scale;
    const y = cy - (lat - location.lat) * scale;
    return { x, y };
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:COLORS.bg, color:COLORS.text, fontFamily:"'Courier New',monospace", fontSize:12, overflow:"hidden" }}>
      <div style={{ position:"fixed", inset:0, backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)", pointerEvents:"none", zIndex:999 }}/>

      {/* TOPBAR */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 14px", borderBottom:`1px solid ${COLORS.border}`, background:COLORS.panel, flexShrink:0 }}>
        <div style={{ fontWeight:900, fontSize:13, letterSpacing:4, color:COLORS.green, textShadow:`0 0 16px ${COLORS.green}` }}>
          MISSION <span style={{ color:COLORS.amber }}>OPR</span>
        </div>
        <div style={{ fontSize:9, color:COLORS.textDim, display:"flex", gap:12, alignItems:"center" }}>
          <span><span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:COLORS.green, boxShadow:`0 0 8px ${COLORS.green}`, marginRight:5, verticalAlign:"middle" }}/>LIVE</span>
          {location ? <span style={{ color:COLORS.green }}>{location.lat.toFixed(4)}° {location.lon.toFixed(4)}°</span> : <span style={{ color:COLORS.amber }}>ACQUIRING GPS...</span>}
        </div>
        <div style={{ fontFamily:"monospace", fontWeight:900, fontSize:14, color:COLORS.amber }}>{score.toLocaleString()} PTS</div>
      </div>

      {/* MAIN */}
      <div style={{ display:"grid", gridTemplateColumns:"185px 1fr", flex:1, overflow:"hidden" }}>

        {/* LEFT */}
        <div style={{ borderRight:`1px solid ${COLORS.border}`, background:COLORS.panel, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ fontSize:9, letterSpacing:3, color:COLORS.green, padding:"7px 10px", borderBottom:`1px solid ${COLORS.border}` }}>// SIGNAL TYPES</div>
          <div style={{ flex:1, overflowY:"auto", padding:6, display:"flex", flexDirection:"column", gap:5 }}>
            {SIGNAL_TYPES.map(sig => (
              <div key={sig.key} style={{ background:"#0a140e", border:`1px solid ${COLORS.border}`, borderLeft:`3px solid ${sig.color}`, borderRadius:3, padding:"7px 9px", position:"relative" }}>
                <div style={{ fontWeight:700, fontSize:11, color:"#fff", letterSpacing:1 }}>{sig.label}</div>
                <div style={{ fontSize:8, color:sig.color, marginTop:2 }}>{sig.pts}</div>
                <div style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontWeight:700, fontSize:12, color:sig.color }}>
                  {sig.key === "aircraft" ? aircraft.length : sig.count}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid ${COLORS.border}`, padding:10 }}>
            <div style={{ fontSize:9, letterSpacing:2, color:COLORS.green, marginBottom:6 }}>// SESSION</div>
            {[["SCORE", score.toLocaleString(), COLORS.amber], ["AIRCRAFT", aircraft.length, COLORS.red], ["GPS", location ? "LOCKED" : "SEARCHING", location ? COLORS.green : COLORS.amber]].map(([l,v,c]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:`1px solid #0d1f14`, fontSize:10 }}>
                <span style={{ color:COLORS.textDim }}>{l}</span>
                <span style={{ color:c, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MAP */}
        <div style={{ position:"relative", background:"#030806", overflow:"hidden" }}>
          <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
            <defs><pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(0,255,136,0.07)" strokeWidth="1"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>

          <svg viewBox="0 0 380 300" style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
            <defs>
              <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="glow2"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>

            <circle cx={cx} cy={cy} r="100" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="5,7" opacity="0.15"/>
            <circle cx={cx} cy={cy} r="50" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="3,5" opacity="0.1"/>

            <ScanRing cx={cx} cy={cy} delay={0}/>
            <ScanRing cx={cx} cy={cy} delay={1000}/>
            <ScanRing cx={cx} cy={cy} delay={2000}/>

            {/* Live aircraft */}
            {aircraft.map(p => {
              const pos = mapToSVG(p.lat, p.lon);
              if (!pos || pos.x < 0 || pos.x > 380 || pos.y < 0 || pos.y > 300) return null;
              return (
                <g key={p.icao} filter="url(#glow)">
                  <polygon points={`${pos.x},${pos.y-8} ${pos.x+5},${pos.y+5} ${pos.x},${pos.y+2} ${pos.x-5},${pos.y+5}`}
                    fill={COLORS.red} transform={`rotate(${p.heading||0},${pos.x},${pos.y})`}/>
                  <text x={pos.x+8} y={pos.y+3} fill={COLORS.red} fontSize="6" fontFamily="monospace">{p.callsign}</text>
                </g>
              );
            })}

            {/* Player */}
            <g filter="url(#glow2)">
              <circle cx={cx} cy={cy} r="10" fill="none" stroke={COLORS.amber} strokeWidth="2"/>
              <circle cx={cx} cy={cy} r="3" fill={COLORS.amber}/>
              <line x1={cx} y1={cy-10} x2={cx} y2={cy-14} stroke={COLORS.amber} strokeWidth="1.5"/>
              <line x1={cx} y1={cy+10} x2={cx} y2={cy+14} stroke={COLORS.amber} strokeWidth="1.5"/>
              <line x1={cx-10} y1={cy} x2={cx-14} y2={cy} stroke={COLORS.amber} strokeWidth="1.5"/>
              <line x1={cx+10} y1={cy} x2={cx+14} y2={cy} stroke={COLORS.amber} strokeWidth="1.5"/>
            </g>
          </svg>

          {/* Toasts */}
          <div style={{ position:"absolute", bottom:50, left:"50%", transform:"translateX(-50%)", display:"flex", flexDirection:"column", gap:5, alignItems:"center", width:260, pointerEvents:"none" }}>
            {toasts.map(t => (
              <div key={t.id} style={{ background:"rgba(0,10,6,0.95)", border:`1px solid ${t.color}`, borderLeft:`3px solid ${t.color}`, padding:"6px 12px", fontSize:9, color:"#fff", borderRadius:2, width:"100%", display:"flex", justifyContent:"space-between" }}>
                <span>{t.msg}</span><span style={{ color:t.color, fontWeight:700, marginLeft:8 }}>{t.pts} PTS</span>
              </div>
            ))}
          </div>

          <div style={{ position:"absolute", top:10, left:"50%", transform:"translateX(-50%)", fontSize:9, letterSpacing:4, color:COLORS.green, opacity:0.5 }}>SCANNING</div>
          {!location && <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", color:COLORS.amber, fontSize:11, letterSpacing:2, textAlign:"center" }}>ACQUIRING GPS<br/><span style={{ fontSize:8, color:COLORS.textDim }}>ALLOW LOCATION ACCESS</span></div>}
        </div>
      </div>

      {/* BOTTOM */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 14px", borderTop:`1px solid ${COLORS.border}`, background:COLORS.panel, flexShrink:0 }}>
        <div style={{ display:"flex", gap:2 }}>
          {["MAP","LOGBOOK","BADGES","SETTINGS"].map(t => (
            <div key={t} onClick={() => setTab(t)} style={{ fontSize:10, letterSpacing:2, padding:"4px 10px", cursor:"pointer", borderRadius:2, color:tab===t?COLORS.green:COLORS.textDim, border:`1px solid ${tab===t?COLORS.green:"transparent"}`, background:tab===t?COLORS.greenFaint:"transparent" }}>{t}</div>
          ))}
        </div>
        <button onClick={triggerScan} style={{ background:"transparent", border:`1px solid ${scanning?COLORS.amber:COLORS.green}`, color:scanning?COLORS.amber:COLORS.green, fontFamily:"monospace", fontSize:9, letterSpacing:2, padding:"4px 12px", cursor:"pointer", borderRadius:2 }}>
          {scanning?"SCANNING...":"[ SCAN ]"}
        </button>
      </div>
    </div>
  );
}
