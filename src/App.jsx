import { useState, useEffect, useRef } from "react";
import TPMSOperator from "./TPMSOperator";
import L from "leaflet";
const PROXY="https://late-lake-aac2.sudosilo2.workers.dev";
const AIS_KEY="69342ff8ab67fe5b44cfd2b53b03eb04879d5dc6";
const SIGNAL_TYPES=[
{key:"wifi",label:"WI-FI AP",pts:"+5-15",color:"#00ff88"},
{key:"bt",label:"BLUETOOTH",pts:"+5-20",color:"#00aaff"},
{key:"cell",label:"CELL TOWER",pts:"+25",color:"#ffaa00"},
{key:"aircraft",label:"AIRCRAFT",pts:"+30-80",color:"#ff3355"},
{key:"train",label:"RAIL/TRAIN",pts:"+20",color:"#aa44ff"},
{key:"meshtastic",label:"MESHTASTIC",pts:"+40",color:"#00ffdd"},
{key:"starlink",label:"STARLINK",pts:"+15",color:"#88aaff"},
{key:"debris",label:"DEBRIS",pts:"+25",color:"#ff6644"},
{key:"rocket",label:"ROCKET BODY",pts:"+30",color:"#ff4488"},
{key:"weather_sat",label:"WEATHER SAT",pts:"+20",color:"#44ddff"},
{key:"gps_sat",label:"GPS SAT",pts:"+20",color:"#88ff44"},
{key:"ships",label:"SHIPS (AIS)",pts:"+35",color:"#00ffcc"},
{key:"ports",label:"PORTS",pts:"+20",color:"#4488ff"},
{key:"ham",label:"HAM REPEATER",pts:"+35",color:"#44ff00"},
{key:"poke",label:"PORTAL/STOP",pts:"+10",color:"#ffdd00"},
{key:"weather",label:"WEATHER STN",pts:"+15",color:"#ff8844"},
];
const SCAN_INTERVALS={aircraft:60,cell:90,trains:120,poke:150,meshtastic:180,starlink:300,debris:330,rocket:360,weather_sat:390,gps_sat:420,weather:600,ports:180};
const SCAN_OFFSETS={aircraft:0,cell:15,trains:30,poke:45,meshtastic:60,starlink:75,debris:90,rocket:105,weather_sat:120,gps_sat:135,weather:150,ports:165};
const MAX_DAILY_SCANS=20;
const getTodayKey=()=>new Date().toISOString().slice(0,10);
const getScanCount=()=>{try{const d=JSON.parse(localStorage.getItem("wigle_scans")||"{}");return d[getTodayKey()]||0}catch(e){return 0}};
const incScanCount=()=>{try{const d=JSON.parse(localStorage.getItem("wigle_scans")||"{}");d[getTodayKey()]=(d[getTodayKey()]||0)+1;localStorage.setItem("wigle_scans",JSON.stringify(d))}catch(e){}};
const SESSION_KEY="mop_sessions";
const getSessions=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"[]")}catch(e){return[]}};
const saveSession=(s)=>{try{const sessions=getSessions();sessions.unshift(s);localStorage.setItem(SESSION_KEY,JSON.stringify(sessions.slice(0,50)))}catch(e){}};
const sessionStart=Date.now();
const initDemoSessions=()=>{if(getSessions().length>0)return;const demos=[{id:Date.now()-86400000*2,score:24680,distance:12.4,duration:5400000,aircraft:18,wifi:34,bt:22,cells:6,weather:4,starlink:12,portals:8,trains:2},{id:Date.now()-86400000,score:18240,distance:8.1,duration:3600000,aircraft:12,wifi:21,bt:15,cells:4,weather:3,starlink:9,portals:5,trains:1},{id:Date.now()-3600000,score:9120,distance:3.2,duration:1800000,aircraft:6,wifi:12,bt:8,cells:2,weather:2,starlink:5,portals:3,trains:0}];demos.forEach(d=>saveSession(d))};
initDemoSessions();
const fmtDur=(ms)=>{const s=Math.floor(ms/1000);const m=Math.floor(s/60);const h=Math.floor(m/60);return h>0?`${h}h ${m%60}m`:`${m}m ${s%60}s`};
const fmtDist=(km)=>km<1?`${Math.round(km*1000)}m`:`${km.toFixed(1)}km`;

function ScanBar({scanKey,lastScans,color,on}){
const[now,setNow]=useState(Date.now());
useEffect(()=>{const iv=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(iv)},[]);
const interval=SCAN_INTERVALS[scanKey]||0;
if(interval===0||!on)return null;
const last=lastScans[scanKey]||0;
const elapsed=last===0?0:Math.floor((now-last)/1000);
const pct=last===0?0:Math.min(100,Math.round((elapsed/interval)*100));
const almostDone=pct>85;
return(
<div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"#0d1510",borderRadius:"0 0 3px 3px",overflow:"hidden"}}>
<div style={{width:`${pct}%`,height:"100%",background:almostDone?"#00ff88":color,opacity:almostDone?1:0.5,transition:"width 0.5s linear"}}/>
</div>
);
}

function Leaderboard(){
const sessions=getSessions();
if(sessions.length===0)return(<div style={{display:"flex",flex:1,background:"#050a08",color:"#a0c8b0",fontFamily:"Courier New,monospace",alignItems:"center",justifyContent:"center"}}><div style={{color:"#4a7a5a",fontSize:10,letterSpacing:3}}>NO SESSIONS YET</div></div>);
const best=Math.max(...sessions.map(s=>s.score));
return(
<div style={{flex:1,overflowY:"auto",padding:8,display:"flex",flexDirection:"column",gap:6,background:"#050a08"}}>
{sessions.map((s,i)=>{
const pct=Math.round(s.score/best*100);const isTop=i===0;
return(<div key={s.id} style={{background:"#0a140e",border:`1px solid ${isTop?"#ffaa00":"#1a3025"}`,borderRadius:4,padding:"8px 10px",position:"relative",overflow:"hidden",fontFamily:"Courier New,monospace"}}>
<div style={{position:"absolute",bottom:0,left:0,height:2,width:`${pct}%`,background:isTop?"#ffaa00":"#00ff88",opacity:0.4}}/>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<div style={{fontSize:10,color:isTop?"#ffaa00":"#4a7a5a",fontWeight:700}}>#{i+1}</div>
<div style={{fontSize:9,color:"#4a7a5a"}}>{new Date(s.id).toLocaleDateString()}</div>
</div>
<div style={{fontSize:14,color:isTop?"#ffaa00":"#00ff88",fontWeight:900}}>{s.score.toLocaleString()}</div>
</div>
<div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
{[["DIST",fmtDist(s.distance||0),"#00ff88"],["TIME",fmtDur(s.duration||0),"#00aaff"],["AIR",s.aircraft||0,"#ff3355"],["WIFI",s.wifi||0,"#00ff88"],["BT",s.bt||0,"#00aaff"],["WX",s.weather||0,"#ff8844"],["STAR",s.starlink||0,"#88aaff"],["CELL",s.cells||0,"#ffaa00"]].map(([l,v,c])=>(
<div key={l} style={{fontSize:7}}><span style={{color:"#4a7a5a"}}>{l} </span><span style={{color:c,fontWeight:700}}>{v}</span></div>
))}
</div>
</div>);})}
<div style={{padding:"6px 0",fontSize:8,color:"#4a7a5a",display:"flex",justifyContent:"space-between",fontFamily:"Courier New,monospace"}}>
<span>BEST: <span style={{color:"#ffaa00",fontWeight:700}}>{best.toLocaleString()} PTS</span></span>
<span>{sessions.length} SESSIONS</span>
</div>
</div>);
}

function TopoMap({location,layers,trailLayers,data}){
const mapRef=useRef(null);const leafletRef=useRef(null);const markersRef=useRef({});const playerRef=useRef(null);const trailsRef=useRef({});const trailHistoryRef=useRef({});
useEffect(()=>{if(!mapRef.current||leafletRef.current)return;const map=L.map(mapRef.current,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,keyboard:false,touchZoom:true,bounceAtZoomLimits:false});L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{maxZoom:17,opacity:0.55}).addTo(map);map.setView([34.05,-118.24],15);leafletRef.current=map;return()=>{map.remove();leafletRef.current=null}},[]);
useEffect(()=>{if(!leafletRef.current||!location)return;const map=leafletRef.current;map.setView([location.lat,location.lon],map.getZoom(),{animate:true});if(playerRef.current){playerRef.current.setLatLng([location.lat,location.lon])}else{const icon=L.divIcon({className:"",html:`<div style="position:relative;width:24px;height:24px;margin:-12px 0 0 -12px"><div style="position:absolute;inset:0;border:2px solid #ffaa00;border-radius:50%;box-shadow:0 0 12px #ffaa00"></div><div style="position:absolute;top:50%;left:50%;width:6px;height:6px;background:#ffaa00;border-radius:50%;transform:translate(-50%,-50%)"></div><div style="position:absolute;top:0;left:50%;width:1px;height:4px;background:#ffaa00;transform:translateX(-50%)"></div><div style="position:absolute;bottom:0;left:50%;width:1px;height:4px;background:#ffaa00;transform:translateX(-50%)"></div><div style="position:absolute;left:0;top:50%;width:4px;height:1px;background:#ffaa00;transform:translateY(-50%)"></div><div style="position:absolute;right:0;top:50%;width:4px;height:1px;background:#ffaa00;transform:translateY(-50%)"></div></div>`,iconSize:[24,24]});playerRef.current=L.marker([location.lat,location.lon],{icon,zIndexOffset:1000}).addTo(map)}},[location]);
useEffect(()=>{
if(!leafletRef.current)return;const map=leafletRef.current;
const ig={
aircraft:layers.aircraft?data.aircraft.map(a=>({id:"ac_"+a.icao,lat:a.lat,lon:a.lon,color:"#ff3355",shape:"triangle",key:"aircraft",heading:a.heading})):[],
train:layers.train?data.trains.map(t=>({id:t.id,lat:t.lat,lon:t.lon,color:"#aa44ff",shape:"square",key:"train"})):[],
cell:layers.cell?data.cells.slice(0,20).map(c=>({id:c.id,lat:c.lat,lon:c.lon,color:"#ffaa00",shape:"square",key:"cell"})):[],
wifi:layers.wifi?data.wifi.slice(0,30).map(w=>({id:"w_"+w.id,lat:w.lat,lon:w.lon,color:"#00ff88",shape:"circle",r:3,key:"wifi"})):[],
bt:layers.bt?data.bt.slice(0,30).map(b=>({id:"b_"+b.id,lat:b.lat,lon:b.lon,color:"#00aaff",shape:"circle",r:3,key:"bt"})):[],
meshtastic:layers.meshtastic?data.meshtastic.map(m=>({id:"m_"+m.id,lat:m.lat,lon:m.lon,color:"#00ffdd",shape:"circle",r:6,key:"meshtastic"})):[],
poke:layers.poke?data.portals.map(p=>({id:"p_"+p.id,lat:p.lat,lon:p.lon,color:"#ffdd00",shape:"diamond",key:"poke"})):[],
starlink:layers.starlink?data.starlink.map(s=>({id:"sl_"+s.satid,lat:s.satlat,lon:s.satlng,color:"#88aaff",shape:"circle",r:3,key:"starlink"})):[],
debris:layers.debris?data.debris.map(s=>({id:"db_"+s.satid,lat:s.satlat,lon:s.satlng,color:"#ff6644",shape:"circle",r:3,key:"debris"})):[],
rocket:layers.rocket?data.rocket.map(s=>({id:"rk_"+s.satid,lat:s.satlat,lon:s.satlng,color:"#ff4488",shape:"diamond",key:"rocket"})):[],
weather_sat:layers.weather_sat?data.weather_sat.map(s=>({id:"ws_"+s.satid,lat:s.satlat,lon:s.satlng,color:"#44ddff",shape:"circle",r:4,key:"weather_sat"})):[],
gps_sat:layers.gps_sat?data.gps_sat.map(s=>({id:"gp_"+s.satid,lat:s.satlat,lon:s.satlng,color:"#88ff44",shape:"circle",r:4,key:"gps_sat"})):[],
ships:layers.ships?data.ships.map(s=>({id:"sh_"+s.id,lat:s.lat,lon:s.lon,color:"#00ffcc",shape:"ship",key:"ships",heading:s.heading,name:s.name})):[],
ports:layers.ports?data.ports.map(p=>({id:"pt_"+p.id,lat:p.lat,lon:p.lon,color:"#4488ff",shape:"port",key:"ports",name:p.name})):[],
weather:layers.weather?data.weather.map(w=>({id:"wx_"+w.id,lat:w.lat,lon:w.lon,color:"#ff8844",shape:"weather",key:"weather",label:w.temp!=null?w.temp+"°F":"?°"})):[],
};
const all=Object.values(ig).flat();const seenIds=new Set();
all.forEach(item=>{
if(!item.lat||!item.lon)return;seenIds.add(item.id);
if(!trailHistoryRef.current[item.id])trailHistoryRef.current[item.id]=[];
const hist=trailHistoryRef.current[item.id];const last=hist[hist.length-1];
if(!last||Math.abs(last[0]-item.lat)>0.0001||Math.abs(last[1]-item.lon)>0.0001){hist.push([item.lat,item.lon]);if(hist.length>50)hist.shift()}
if(trailLayers[item.key]&&hist.length>1){if(trailsRef.current[item.id]){trailsRef.current[item.id].setLatLngs(hist)}else{trailsRef.current[item.id]=L.polyline(hist,{color:item.color,weight:1,opacity:0.5,smoothFactor:1}).addTo(map)}}
else if(trailsRef.current[item.id]&&!trailLayers[item.key]){trailsRef.current[item.id].remove();delete trailsRef.current[item.id]}
if(!markersRef.current[item.id]){
const r=item.r||5;let html;
if(item.shape==="diamond")html=`<div style="width:8px;height:8px;background:${item.color};transform:rotate(45deg);box-shadow:0 0 6px ${item.color};margin:-4px 0 0 -4px"></div>`;
else if(item.shape==="triangle")html=`<div style="width:7px;height:7px;margin:-3px 0 0 -3px;transform:rotate(${item.heading||0}deg)"><svg viewBox="0 0 14 14"><polygon points="7,0 9,5 14,6 9,7 10,14 7,11 4,14 5,7 0,6 5,5" fill="${item.color}" style="filter:drop-shadow(0 0 2px ${item.color})"/></svg></div>`;
else if(item.shape==="square")html=`<div style="width:8px;height:8px;background:${item.color};box-shadow:0 0 5px ${item.color};margin:-4px 0 0 -4px"></div>`;
else if(item.shape==="ship")html=`<div style="width:10px;height:10px;margin:-5px 0 0 -5px;transform:rotate(${item.heading||0}deg)"><svg viewBox="0 0 10 10"><polygon points="5,0 8,8 5,6 2,8" fill="${item.color}" style="filter:drop-shadow(0 0 3px ${item.color})"/></svg></div>`;
else if(item.shape==="port")html=`<div style="width:10px;height:10px;margin:-5px 0 0 -5px"><svg viewBox="0 0 10 10"><rect x="1" y="4" width="8" height="5" fill="${item.color}" rx="1" style="filter:drop-shadow(0 0 3px ${item.color})"/><rect x="4" y="0" width="2" height="5" fill="${item.color}"/><rect x="2" y="1" width="6" height="1" fill="${item.color}"/></svg></div>`;
else if(item.shape==="weather")html=`<div style="background:rgba(255,136,68,0.85);border:1px solid #ff8844;border-radius:3px;padding:1px 3px;font-size:8px;font-family:monospace;color:#fff;white-space:nowrap;box-shadow:0 0 6px #ff8844;margin:-8px 0 0 -12px">${item.label}</div>`;
else html=`<div style="width:${r*2}px;height:${r*2}px;background:${item.color};border-radius:50%;box-shadow:0 0 5px ${item.color};margin:-${r}px 0 0 -${r}px"></div>`;
const icon=L.divIcon({className:"",html});
markersRef.current[item.id]=L.marker([item.lat,item.lon],{icon}).addTo(map);
}else{markersRef.current[item.id].setLatLng([item.lat,item.lon])}
});
Object.keys(markersRef.current).forEach(id=>{if(!seenIds.has(id)){markersRef.current[id].remove();delete markersRef.current[id];if(trailsRef.current[id]){trailsRef.current[id].remove();delete trailsRef.current[id]}}});
},[layers,trailLayers,data]);
return<div ref={mapRef} style={{position:"absolute",inset:0,zIndex:0}}/>;
}

export default function App(){
const[location,setLocation]=useState(null);
const[aircraft,setAircraft]=useState([]);
const[trains,setTrains]=useState([]);
const[cells,setCells]=useState([]);
const[meshtastic,setMeshtastic]=useState([]);
const[wifi,setWifi]=useState([]);
const[bt,setBt]=useState([]);
const[portals,setPortals]=useState([]);
const[starlink,setStarlink]=useState([]);
const[debris,setDebris]=useState([]);
const[rocket,setRocket]=useState([]);
const[weather_sat,setWeatherSat]=useState([]);
const[gps_sat,setGpsSat]=useState([]);
const[ships,setShips]=useState([]);
const[ports,setPorts]=useState([]);
const[weather,setWeather]=useState([]);
const[toasts,setToasts]=useState([]);
const[score,setScore]=useState(0);
const[tab,setTab]=useState("MAP");
const[layers,setLayers]=useState({wifi:true,bt:true,cell:true,aircraft:true,train:true,meshtastic:true,starlink:true,debris:true,rocket:true,weather_sat:true,gps_sat:true,ships:true,ports:true,ham:true,poke:true,weather:true});
const[trailLayers,setTrailLayers]=useState({wifi:false,bt:false,cell:false,aircraft:false,train:false,meshtastic:false,starlink:false,debris:false,rocket:false,weather_sat:false,gps_sat:false,ships:false,ports:false,poke:false,weather:false});
const[scanning,setScanning]=useState(false);
const[scanCount,setScanCount]=useState(getScanCount());
const[selectedWeather,setSelectedWeather]=useState(null);
const[distance,setDistance]=useState(0);
const[elapsed,setElapsed]=useState(0);
const[lastScans,setLastScans]=useState({});
const tid=useRef(0);
const seen=useRef(new Set());
const nwsGrid=useRef(null);
const lastPos=useRef(null);
const layersRef=useRef(layers);
const locationRef=useRef(null);
const aisWsRef=useRef(null);
const sessionCounts=useRef({aircraft:0,wifi:0,bt:0,cells:0,weather:0,starlink:0,portals:0,trains:0,ships:0});
useEffect(()=>{layersRef.current=layers},[layers]);
useEffect(()=>{locationRef.current=location},[location]);

const lastScansRef=useRef({});
const markScan=(key)=>{lastScansRef.current={...lastScansRef.current,[key]:Date.now()};setLastScans({...lastScansRef.current})};
const toggleLayer=(key)=>{
setLayers(l=>{
const newVal=!l[key];
if(!newVal){setLastScans(ls=>({...ls,[key]:0}))}
else{
const interval=SCAN_INTERVALS[key]||0;
setLastScans(ls=>{const last=ls[key]||0;const elapsedSec=last===0?interval+1:Math.floor((Date.now()-last)/1000);if(interval>0&&elapsedSec>=interval)return{...ls,[key]:Date.now()-(interval+1)*1000};return ls});
}
return{...l,[key]:newVal};
});
};
const toggleTrail=(key)=>setTrailLayers(l=>({...l,[key]:!l[key]}));

useEffect(()=>{const iv=setInterval(()=>setElapsed(Date.now()-sessionStart),1000);return()=>clearInterval(iv)},[]);
useEffect(()=>{
if(!navigator.geolocation)return;
navigator.geolocation.watchPosition(p=>{
const newPos={lat:p.coords.latitude,lon:p.coords.longitude};setLocation(newPos);
if(lastPos.current){const R=6371;const dLat=(newPos.lat-lastPos.current.lat)*Math.PI/180;const dLon=(newPos.lon-lastPos.current.lon)*Math.PI/180;const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lastPos.current.lat*Math.PI/180)*Math.cos(newPos.lat*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);const km=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));if(km>0.005)setDistance(d=>d+km)}
lastPos.current=newPos;
},e=>console.error(e),{enableHighAccuracy:true});
},[]);
useEffect(()=>{const save=()=>{if(score===0)return;saveSession({id:sessionStart,score,distance:parseFloat(distance.toFixed(2)),duration:Date.now()-sessionStart,...sessionCounts.current})};window.addEventListener("beforeunload",save);return()=>window.removeEventListener("beforeunload",save)},[score,distance]);

// AIS WebSocket — live ships, reconnects when location changes
useEffect(()=>{
if(!location||!layers.ships)return;
if(aisWsRef.current){aisWsRef.current.close();aisWsRef.current=null}
const{lat,lon}=location;
const pad=5;
const bbox=[[[lat-pad,lon-pad],[lat+pad,lon+pad]]];
try{
const ws=new WebSocket("wss://stream.aisstream.io/v0/stream");
aisWsRef.current=ws;
ws.onopen=()=>{
ws.send(JSON.stringify({APIKey:AIS_KEY,BoundingBoxes:bbox,FilterMessageTypes:["PositionReport"]}));
markScan("ships");
};
ws.onmessage=(evt)=>{
try{
const d=JSON.parse(evt.data);
const pr=d.Message?.PositionReport;
const meta=d.MetaData;
if(!pr||!meta)return;
const shipLat=pr.Latitude;const shipLon=pr.Longitude;
if(!shipLat||!shipLon)return;
const id=pr.UserID||meta.MMSI;
const name=(meta.ShipName||"VESSEL").trim();
const heading=pr.TrueHeading<360?pr.TrueHeading:pr.Cog||0;
setShips(prev=>{
const existing=prev.find(s=>s.id===id);
if(existing)return prev.map(s=>s.id===id?{...s,lat:shipLat,lon:shipLon,heading,lastSeen:Date.now()}:s);
if(!seen.current.has("ship_"+id)){
seen.current.add("ship_"+id);
const pts=35;const tid2=tid.current++;
setScore(s=>s+pts);
sessionCounts.current.ships++;
setToasts(t=>[...t,{id:tid2,msg:`SHIP ${name}`,pts:`+${pts}`,color:"#00ffcc"}]);
setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==tid2)),3200);
}
return[...prev.slice(-99),{id,name,lat:shipLat,lon:shipLon,heading,lastSeen:Date.now()}];
});
}catch(e){}
};
ws.onerror=()=>{};
ws.onclose=()=>{aisWsRef.current=null};
}catch(e){console.error("AIS",e)}
return()=>{if(aisWsRef.current){aisWsRef.current.close();aisWsRef.current=null}};
},[location,layers.ships]);

// PORTS — offset 165s, interval 180s
useEffect(()=>{
if(!location)return;
let iv;
const run=()=>{
if(!layersRef.current.ports)return;
const{lat,lon}=locationRef.current||location;
markScan("ports");
const d=2.0;
const query=`[out:json];(node["harbour"](${lat-d},${lon-d},${lat+d},${lon+d});node["seamark:type"="harbour"](${lat-d},${lon-d},${lat+d},${lon+d});way["harbour"](${lat-d},${lon-d},${lat+d},${lon+d}););out center;`;
fetch(`https://overpass-api.de/api/interpreter`,{method:"POST",body:`data=${encodeURIComponent(query)}`}).then(r=>r.json()).then(data=>{
const ps=(data.elements||[]).map(e=>({id:"pt_"+e.id,name:e.tags?.name||e.tags?.["seamark:name"]||"PORT",lat:e.lat||e.center?.lat,lon:e.lon||e.center?.lon})).filter(p=>p.lat&&p.lon);
ps.forEach(p=>{if(!seen.current.has("port_"+p.id)){seen.current.add("port_"+p.id);const id=tid.current++;setScore(s=>s+20);setToasts(t=>[...t,{id,msg:`PORT ${p.name}`,pts:"+20",color:"#4488ff"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});
setPorts(ps);
}).catch(e=>console.error(e));
};
const t=setTimeout(()=>{run();iv=setInterval(run,180000)},SCAN_OFFSETS.ports*1000);
return()=>{clearTimeout(t);clearInterval(iv)};
},[location]);

// AIRCRAFT — offset 0s, interval 60s
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.aircraft)return;const{lat,lon}=locationRef.current||location;markScan("aircraft");fetch(`https://opensky-network.org/api/states/all?lamin=${lat-0.5}&lomin=${lon-0.5}&lamax=${lat+0.5}&lomax=${lon+0.5}`).then(r=>r.json()).then(d=>{const planes=(d.states||[]).map(s=>({icao:s[0],callsign:(s[1]||s[0]).trim(),lon:s[5],lat:s[6],alt:s[7],heading:s[10]})).filter(p=>p.lat&&p.lon);planes.forEach(p=>{if(!seen.current.has(p.icao)){seen.current.add(p.icao);const pts=p.alt>10000?30:p.alt>3000?55:80;const id=tid.current++;setScore(s=>s+pts);sessionCounts.current.aircraft++;setToasts(t=>[...t,{id,msg:`AIRCRAFT ${p.callsign}`,pts:`+${pts}`,color:"#ff3355"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setAircraft(planes)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,60000)},SCAN_OFFSETS.aircraft*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.cell)return;const{lat,lon}=locationRef.current||location;markScan("cell");const d=0.5;const query=`[out:json];node["man_made"="mast"](${lat-d},${lon-d},${lat+d},${lon+d});out;`;fetch(`https://overpass-api.de/api/interpreter`,{method:"POST",body:`data=${encodeURIComponent(query)}`}).then(r=>r.json()).then(data=>{const towers=(data.elements||[]).slice(0,20).map(e=>({id:"cell_"+e.id,name:e.tags?.operator||e.tags?.name||"CELL TOWER",lat:e.lat,lon:e.lon}));towers.forEach(t=>{if(!seen.current.has("cell_"+t.id)){seen.current.add("cell_"+t.id);const id=tid.current++;setScore(s=>s+25);sessionCounts.current.cells++;setToasts(ts=>[...ts,{id,msg:`CELL ${t.name}`,pts:"+25",color:"#ffaa00"}]);setTimeout(()=>setToasts(ts=>ts.filter(x=>x.id!==id)),3200)}});setCells(towers)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,90000)},SCAN_OFFSETS.cell*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.train)return;const{lat,lon}=locationRef.current||location;markScan("trains");const d=1.5;const query=`[out:json];node["railway"="station"](${lat-d},${lon-d},${lat+d},${lon+d});out;`;fetch(`https://overpass-api.de/api/interpreter`,{method:"POST",body:`data=${encodeURIComponent(query)}`}).then(r=>r.json()).then(data=>{const stations=(data.elements||[]).map(e=>({id:"osm_"+e.id,name:e.tags?.name||"STATION",lat:e.lat,lon:e.lon}));stations.forEach(s=>{if(!seen.current.has("train_"+s.id)){seen.current.add("train_"+s.id);const id=tid.current++;setScore(sc=>sc+20);sessionCounts.current.trains++;setToasts(t=>[...t,{id,msg:`RAIL ${s.name}`,pts:"+20",color:"#aa44ff"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setTrains(stations)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,120000)},SCAN_OFFSETS.trains*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.poke)return;const{lat,lon}=locationRef.current||location;markScan("poke");const d=0.05;const query=`[out:json];(node["tourism"~"artwork|attraction|museum|viewpoint"]["name"](${lat-d},${lon-d},${lat+d},${lon+d});node["historic"]["name"](${lat-d},${lon-d},${lat+d},${lon+d});node["amenity"~"place_of_worship|library|fountain"]["name"](${lat-d},${lon-d},${lat+d},${lon+d}););out;`;fetch(`https://overpass-api.de/api/interpreter`,{method:"POST",body:`data=${encodeURIComponent(query)}`}).then(r=>r.json()).then(data=>{const pois=(data.elements||[]).map(e=>({id:"poi_"+e.id,name:e.tags?.name||"PORTAL",lat:e.lat,lon:e.lon}));pois.forEach(p=>{if(!seen.current.has("portal_"+p.id)){seen.current.add("portal_"+p.id);const id=tid.current++;setScore(s=>s+10);sessionCounts.current.portals++;setToasts(t=>[...t,{id,msg:`PORTAL ${p.name.substring(0,20)}`,pts:"+10",color:"#ffdd00"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setPortals(pois)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,150000)},SCAN_OFFSETS.poke*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.meshtastic)return;const{lat,lon}=locationRef.current||location;markScan("meshtastic");fetch(`https://meshtastic.liamcottle.net/api/v1/nodes?limit=100`).then(r=>r.json()).then(d=>{const nodes=(d.nodes||[]).filter(n=>n.latitude&&n.longitude).map(n=>({id:n.node_id,name:n.long_name||n.short_name||"MESH",lat:n.latitude>1000000?n.latitude/1e7:n.latitude,lon:n.longitude>1000000?n.longitude/1e7:n.longitude})).filter(n=>Math.abs(n.lat-lat)<1&&Math.abs(n.lon-lon)<1);nodes.forEach(n=>{if(!seen.current.has("mesh_"+n.id)){seen.current.add("mesh_"+n.id);const id=tid.current++;setScore(s=>s+40);setToasts(t=>[...t,{id,msg:`MESH ${n.name}`,pts:"+40",color:"#00ffdd"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setMeshtastic(nodes)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,180000)},SCAN_OFFSETS.meshtastic*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.starlink)return;const{lat,lon}=locationRef.current||location;markScan("starlink");fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=satellite&cat=52`).then(r=>r.json()).then(d=>{const sats=(d.above||[]).slice(0,100);sats.forEach(s=>{if(!seen.current.has("sl_"+s.satid)){seen.current.add("sl_"+s.satid);const id=tid.current++;setScore(sc=>sc+15);setToasts(t=>[...t,{id,msg:`STARLINK ${s.satname}`,pts:"+15",color:"#88aaff"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setStarlink(sats)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,300000)},SCAN_OFFSETS.starlink*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.debris)return;const{lat,lon}=locationRef.current||location;markScan("debris");fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=satellite&cat=6`).then(r=>r.json()).then(d=>{const sats=(d.above||[]).slice(0,100);sats.forEach(s=>{if(!seen.current.has("db_"+s.satid)){seen.current.add("db_"+s.satid);const id=tid.current++;setScore(sc=>sc+25);setToasts(t=>[...t,{id,msg:`DEBRIS ${s.satname}`,pts:"+25",color:"#ff6644"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setDebris(sats)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,330000)},SCAN_OFFSETS.debris*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.rocket)return;const{lat,lon}=locationRef.current||location;markScan("rocket");fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=satellite&cat=rocket`).then(r=>r.json()).then(d=>{const sats=(d.above||[]).slice(0,100);sats.forEach(s=>{if(!seen.current.has("rk_"+s.satid)){seen.current.add("rk_"+s.satid);const id=tid.current++;setScore(sc=>sc+30);setToasts(t=>[...t,{id,msg:`ROCKET ${s.satname}`,pts:"+30",color:"#ff4488"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setRocket(sats)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,360000)},SCAN_OFFSETS.rocket*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.weather_sat)return;const{lat,lon}=locationRef.current||location;markScan("weather_sat");fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=satellite&cat=20`).then(r=>r.json()).then(d=>{const sats=(d.above||[]).slice(0,100);sats.forEach(s=>{if(!seen.current.has("ws_"+s.satid)){seen.current.add("ws_"+s.satid);const id=tid.current++;setScore(sc=>sc+20);setToasts(t=>[...t,{id,msg:`WXSAT ${s.satname}`,pts:"+20",color:"#44ddff"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setWeatherSat(sats)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,390000)},SCAN_OFFSETS.weather_sat*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=()=>{if(!layersRef.current.gps_sat)return;const{lat,lon}=locationRef.current||location;markScan("gps_sat");fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=satellite&cat=24`).then(r=>r.json()).then(d=>{const sats=(d.above||[]).slice(0,100);sats.forEach(s=>{if(!seen.current.has("gp_"+s.satid)){seen.current.add("gp_"+s.satid);const id=tid.current++;setScore(sc=>sc+20);setToasts(t=>[...t,{id,msg:`GPS SAT ${s.satname}`,pts:"+20",color:"#88ff44"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setGpsSat(sats)}).catch(e=>console.error(e))};const t=setTimeout(()=>{run();iv=setInterval(run,420000)},SCAN_OFFSETS.gps_sat*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);
useEffect(()=>{if(!location)return;let iv;const run=async()=>{if(!layersRef.current.weather)return;const{lat,lon}=locationRef.current||location;markScan("weather");try{if(!nwsGrid.current){const gr=await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);const gd=await gr.json();const{gridId,gridX,gridY}=gd.properties;nwsGrid.current={gridId,gridX,gridY}}const{gridId,gridX,gridY}=nwsGrid.current;const sr=await fetch(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/stations`);const sd=await sr.json();const wxData=await Promise.all((sd.features||[]).slice(0,10).map(async s=>{const sid=s.properties.stationIdentifier;const sname=s.properties.name;const coords=s.geometry.coordinates;try{const or=await fetch(`https://api.weather.gov/stations/${sid}/observations/latest`);const od=await or.json();const p=od.properties;const tempC=p.temperature?.value;const tempF=tempC!=null?Math.round(tempC*9/5+32):null;return{id:sid,name:sname,lat:coords[1],lon:coords[0],temp:tempF,tempC:tempC!=null?Math.round(tempC):null,wind:p.windSpeed?.value?Math.round(p.windSpeed.value):null,humidity:p.relativeHumidity?.value?Math.round(p.relativeHumidity.value):null,desc:p.textDescription||""}}catch(e){return{id:sid,name:sname,lat:coords[1],lon:coords[0],temp:null,tempC:null,wind:null,humidity:null,desc:""}}}));wxData.forEach(w=>{if(!seen.current.has("wx_"+w.id)){seen.current.add("wx_"+w.id);const id=tid.current++;setScore(s=>s+15);sessionCounts.current.weather++;setToasts(t=>[...t,{id,msg:`WEATHER ${w.name}${w.temp!=null?" · "+w.temp+"°F":""}`,pts:"+15",color:"#ff8844"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setWeather(wxData)}catch(e){console.error("weather",e)}};const t=setTimeout(()=>{run();iv=setInterval(run,600000)},SCAN_OFFSETS.weather*1000);return()=>{clearTimeout(t);clearInterval(iv)}},[location]);

const doScan=async()=>{if(!location||scanning)return;const count=getScanCount();if(count>=MAX_DAILY_SCANS){const id=tid.current++;setToasts(t=>[...t,{id,msg:`SCAN LIMIT · ${MAX_DAILY_SCANS}/day`,pts:"",color:"#ff3355"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200);return}setScanning(true);incScanCount();setScanCount(getScanCount());const{lat,lon}=location;const d=0.001;try{const[wRes,bRes]=await Promise.all([fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=wifi`),fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=bt`)]);const[wData,bData]=await Promise.all([wRes.json(),bRes.json()]);const nets=(wData.results||[]).filter(n=>n.ssid&&n.trilat&&n.trilong&&Math.abs(n.trilat-lat)<d&&Math.abs(n.trilong-lon)<d).map(n=>({id:n.netid,ssid:n.ssid,lat:n.trilat,lon:n.trilong}));const devs=(bData.results||[]).filter(n=>n.trilat&&n.trilong&&Math.abs(n.trilat-lat)<d&&Math.abs(n.trilong-lon)<d).map(n=>({id:n.netid,name:n.ssid||"BT DEVICE",lat:n.trilat,lon:n.trilong}));let newPts=0;nets.forEach(n=>{if(!seen.current.has("wifi_"+n.id)){seen.current.add("wifi_"+n.id);const pts=Math.floor(Math.random()*11)+5;newPts+=pts;sessionCounts.current.wifi++;setScore(s=>s+pts)}});devs.forEach(n=>{if(!seen.current.has("bt_"+n.id)){seen.current.add("bt_"+n.id);const pts=Math.floor(Math.random()*16)+5;newPts+=pts;sessionCounts.current.bt++;setScore(s=>s+pts)}});setWifi(w=>[...w,...nets.filter(n=>!w.find(x=>x.id===n.id))]);setBt(b=>[...b,...devs.filter(n=>!b.find(x=>x.id===n.id))]);const id=tid.current++;setToasts(t=>[...t,{id,msg:`SCAN · ${nets.length} WIFI · ${devs.length} BT`,pts:newPts>0?`+${newPts}`:"",color:"#00ff88"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}catch(e){console.error(e)}setScanning(false)};

const data={aircraft,trains,cells,wifi,bt,meshtastic,portals,starlink,debris,rocket,weather_sat,gps_sat,ships,ports,weather};
const scansLeft=MAX_DAILY_SCANS-scanCount;
const NAV=["MAP","LOG","BADGES","TPMS","SET"];
if(tab==="TPMS")return<div style={{height:"100vh"}}><TPMSOperator setTab={setTab}/></div>;
if(tab==="LOG")return(<div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#050a08"}}><div style={{padding:"6px 12px",borderBottom:"1px solid #1a3025",background:"#080f0b",flexShrink:0,fontFamily:"Courier New,monospace",fontWeight:900,fontSize:13,letterSpacing:4,color:"#00ff88"}}>MISSION <span style={{color:"#ffaa00"}}>OPR</span></div><Leaderboard/><div style={{display:"flex",gap:2,padding:"5px 10px",borderTop:"1px solid #1a3025",background:"#080f0b",flexShrink:0}}>{NAV.map(t=>(<div key={t} onClick={()=>setTab(t)} style={{fontSize:8,letterSpacing:1,padding:"3px 6px",cursor:"pointer",borderRadius:2,color:tab===t?"#00ff88":"#4a7a5a",border:`1px solid ${tab===t?"#00ff88":"transparent"}`}}>{t}</div>))}</div></div>);
return(
<div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#050a08",color:"#a0c8b0",fontFamily:"Courier New,monospace",fontSize:12,overflow:"hidden"}}>
<div style={{position:"fixed",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)",pointerEvents:"none",zIndex:998}}/>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",borderBottom:"1px solid #1a3025",background:"#080f0b",flexShrink:0,zIndex:10,position:"relative"}}>
<div style={{fontWeight:900,fontSize:13,letterSpacing:4,color:"#00ff88",textShadow:"0 0 16px #00ff88"}}>MISSION <span style={{color:"#ffaa00"}}>OPR</span></div>
<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
<div style={{fontSize:9}}>{location?<span style={{color:"#00ff88"}}>{location.lat.toFixed(4)}° {location.lon.toFixed(4)}°</span>:<span style={{color:"#ffaa00"}}>ACQUIRING GPS...</span>}</div>
<div style={{display:"flex",gap:8,fontSize:7}}><span style={{color:"#00ff88"}}>{fmtDur(elapsed)}</span><span style={{color:"#00aaff"}}>{fmtDist(distance)}</span></div>
</div>
<div style={{fontWeight:900,fontSize:14,color:"#ffaa00"}}>{score.toLocaleString()} PTS</div>
</div>
<div style={{display:"grid",gridTemplateColumns:"145px 1fr",flex:1,overflow:"hidden",position:"relative"}}>
<div style={{borderRight:"1px solid #1a3025",background:"#080f0b",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",zIndex:10}}>
<div style={{fontSize:8,letterSpacing:3,color:"#00ff88",padding:"6px 8px",borderBottom:"1px solid #1a3025"}}>{"//"} SIGNALS</div>
<div style={{flex:1,overflowY:"auto",padding:4,display:"flex",flexDirection:"column",gap:3}}>
{SIGNAL_TYPES.map(s=>{
const count=s.key==="aircraft"?aircraft.length:s.key==="train"?trains.length:s.key==="cell"?cells.length:s.key==="wifi"?wifi.length:s.key==="bt"?bt.length:s.key==="meshtastic"?meshtastic.length:s.key==="poke"?portals.length:s.key==="starlink"?starlink.length:s.key==="debris"?debris.length:s.key==="rocket"?rocket.length:s.key==="weather_sat"?weather_sat.length:s.key==="gps_sat"?gps_sat.length:s.key==="ships"?ships.length:s.key==="ports"?ports.length:s.key==="weather"?weather.length:0;
const on=layers[s.key]!==false;const trail=trailLayers[s.key]||false;const isManual=s.key==="wifi"||s.key==="bt";
return(<div key={s.key} style={{background:"#0a140e",border:`1px solid ${on?"#1a3025":"#0d1510"}`,borderLeft:`3px solid ${on?s.color:"#1a3025"}`,borderRadius:3,padding:"3px 6px",position:"relative",opacity:on?1:0.4}}>
<div style={{fontWeight:700,fontSize:8,color:on?"#fff":"#4a7a5a"}}>{s.label}{isManual&&<span style={{fontSize:6,color:"#4a7a5a",marginLeft:3}}>M</span>}</div>
<div style={{fontSize:6,color:on?s.color:"#1a3025"}}>{s.pts}</div>
<div style={{position:"absolute",right:34,top:"50%",transform:"translateY(-50%)",fontWeight:700,fontSize:9,color:on?s.color:"#1a3025"}}>{count}</div>
<div onClick={()=>toggleTrail(s.key)} style={{position:"absolute",right:18,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:8,opacity:trail?1:0.25,lineHeight:1}}>〰</div>
<div onClick={()=>toggleLayer(s.key)} style={{position:"absolute",right:3,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:on?"#ff3355":"#4a7a5a",fontSize:9,fontWeight:900,lineHeight:1}}>✕</div>
<ScanBar scanKey={s.key} lastScans={lastScans} color={s.color} on={on}/>
</div>);})}
</div>
<div style={{borderTop:"1px solid #1a3025",padding:6}}>
{[["SCORE",score.toLocaleString(),"#ffaa00"],["DIST",fmtDist(distance),"#00aaff"],["AIR",aircraft.length,"#ff3355"],["SHIPS",ships.length,"#00ffcc"],["STAR",starlink.length,"#88aaff"],["DEBR",debris.length,"#ff6644"],["RCKT",rocket.length,"#ff4488"],["WXST",weather_sat.length,"#44ddff"],["GPS",gps_sat.length,"#88ff44"],["WX",weather.length,"#ff8844"],["LOC",location?"LOCK":"SRCH",location?"#00ff88":"#ffaa00"]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"1px 0",borderBottom:"1px solid #0d1f14",fontSize:8}}><span style={{color:"#4a7a5a"}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}</span></div>))}
</div>
</div>
<div style={{position:"relative",overflow:"hidden"}}>
<TopoMap location={location} layers={layers} trailLayers={trailLayers} data={data}/>
<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:2}}>
<circle cx="190" cy="155" r="80" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="5,7" opacity="0.25"/>
<circle cx="190" cy="155" r="40" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="3,5" opacity="0.15"/>
</svg>
{selectedWeather&&(<div onClick={()=>setSelectedWeather(null)} style={{position:"absolute",top:40,left:"50%",transform:"translateX(-50%)",background:"rgba(8,15,11,0.95)",border:"1px solid #ff8844",borderRadius:4,padding:"10px 14px",zIndex:5,minWidth:200,cursor:"pointer"}}><div style={{fontSize:9,color:"#ff8844",letterSpacing:2,marginBottom:6}}>{selectedWeather.name}</div>{selectedWeather.temp!=null&&<div style={{fontSize:14,color:"#fff",fontWeight:700}}>{selectedWeather.temp}°F / {selectedWeather.tempC}°C</div>}{selectedWeather.humidity!=null&&<div style={{fontSize:8,color:"#4a7a5a",marginTop:3}}>HUMIDITY: {selectedWeather.humidity}%</div>}{selectedWeather.wind!=null&&<div style={{fontSize:8,color:"#4a7a5a"}}>WIND: {selectedWeather.wind} km/h</div>}{selectedWeather.desc&&<div style={{fontSize:8,color:"#a0c8b0",marginTop:4}}>{selectedWeather.desc}</div>}<div style={{fontSize:7,color:"#4a7a5a",marginTop:6}}>TAP TO CLOSE</div></div>)}
<div style={{position:"absolute",bottom:45,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:3,alignItems:"center",width:180,pointerEvents:"none",zIndex:3}}>
{toasts.map(t=>(<div key={t.id} style={{background:"rgba(0,10,6,0.5)",border:`1px solid ${t.color}`,borderLeft:`3px solid ${t.color}`,padding:"3px 7px",fontSize:7,color:"#fff",borderRadius:2,width:"100%",display:"flex",justifyContent:"space-between",backdropFilter:"blur(4px)"}}><span>{t.msg}</span><span style={{color:t.color,fontWeight:700,marginLeft:6}}>{t.pts}</span></div>))}
</div>
{!location&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#ffaa00",fontSize:11,letterSpacing:2,textAlign:"center",zIndex:3,background:"rgba(0,0,0,0.7)",padding:"12px 20px",borderRadius:4}}>ACQUIRING GPS<br/><span style={{fontSize:8,color:"#4a7a5a"}}>ALLOW LOCATION ACCESS</span></div>}
<div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",fontSize:8,letterSpacing:4,color:"#00ff88",opacity:0.7,zIndex:3,textShadow:"0 0 8px #00ff88",background:"rgba(0,0,0,0.4)",padding:"2px 8px",borderRadius:2}}>SCANNING</div>
</div>
</div>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 10px",borderTop:"1px solid #1a3025",background:"#080f0b",flexShrink:0,position:"relative",zIndex:10}}>
<div style={{display:"flex",gap:2}}>{NAV.map(t=>(<div key={t} onClick={()=>setTab(t)} style={{fontSize:8,letterSpacing:1,padding:"3px 6px",cursor:"pointer",borderRadius:2,color:tab===t?"#00ff88":"#4a7a5a",border:`1px solid ${tab===t?"#00ff88":"transparent"}`}}>{t}</div>))}</div>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:7,color:scansLeft<5?"#ff3355":"#4a7a5a"}}>{scansLeft}/{MAX_DAILY_SCANS}</span>
<button onClick={doScan} disabled={scanning||scansLeft<=0} style={{background:"transparent",border:`1px solid ${scanning?"#ffaa00":scansLeft<=0?"#ff3355":"#00ff88"}`,color:scanning?"#ffaa00":scansLeft<=0?"#ff3355":"#00ff88",fontFamily:"monospace",fontSize:8,letterSpacing:2,padding:"3px 10px",cursor:scansLeft<=0?"not-allowed":"pointer",borderRadius:2}}>{scanning?"SCANNING...":scansLeft<=0?"LIMIT":"[ SCAN ]"}</button>
</div>
</div>
</div>
);}
