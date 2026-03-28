import { useState, useEffect, useRef } from "react";
import TPMSOperator from "./TPMSOperator";
import L from "leaflet";
const PROXY="https://late-lake-aac2.sudosilo2.workers.dev";
const SIGNAL_TYPES=[{key:"wifi",label:"WI-FI AP",pts:"+5-15",color:"#00ff88"},{key:"bt",label:"BLUETOOTH",pts:"+5-20",color:"#00aaff"},{key:"cell",label:"CELL TOWER",pts:"+25",color:"#ffaa00"},{key:"aircraft",label:"AIRCRAFT",pts:"+30-80",color:"#ff3355"},{key:"train",label:"RAIL/TRAIN",pts:"+20",color:"#aa44ff"},{key:"meshtastic",label:"MESHTASTIC",pts:"+40",color:"#00ffdd"},{key:"starlink",label:"STARLINK",pts:"+15",color:"#88aaff"},{key:"ham",label:"HAM REPEATER",pts:"+35",color:"#44ff00"},{key:"poke",label:"PORTAL/STOP",pts:"+10",color:"#ffdd00"}];
const MAX_DAILY_SCANS=20;
const getTodayKey=()=>new Date().toISOString().slice(0,10);
const getScanCount=()=>{try{const d=JSON.parse(localStorage.getItem("wigle_scans")||"{}");return d[getTodayKey()]||0}catch(e){return 0}};
const incScanCount=()=>{try{const d=JSON.parse(localStorage.getItem("wigle_scans")||"{}");d[getTodayKey()]=(d[getTodayKey()]||0)+1;localStorage.setItem("wigle_scans",JSON.stringify(d))}catch(e){}};

function TopoMap({location,layers,trailLayers,data}){
const mapRef=useRef(null);
const leafletRef=useRef(null);
const markersRef=useRef({});
const playerRef=useRef(null);
const trailsRef=useRef({});
const trailHistoryRef=useRef({});

useEffect(()=>{
if(!mapRef.current||leafletRef.current)return;
const map=L.map(mapRef.current,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,keyboard:false,touchZoom:true,bounceAtZoomLimits:false});
L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{maxZoom:17,opacity:0.55}).addTo(map);
map.setView([34.05,-118.24],15);
leafletRef.current=map;
return()=>{map.remove();leafletRef.current=null};
},[]);

useEffect(()=>{
if(!leafletRef.current||!location)return;
const map=leafletRef.current;
map.setView([location.lat,location.lon],map.getZoom(),{animate:true});
if(playerRef.current){playerRef.current.setLatLng([location.lat,location.lon])}
else{const icon=L.divIcon({className:"",html:`<div style="position:relative;width:24px;height:24px;margin:-12px 0 0 -12px"><div style="position:absolute;inset:0;border:2px solid #ffaa00;border-radius:50%;box-shadow:0 0 12px #ffaa00"></div><div style="position:absolute;top:50%;left:50%;width:6px;height:6px;background:#ffaa00;border-radius:50%;transform:translate(-50%,-50%)"></div><div style="position:absolute;top:0;left:50%;width:1px;height:4px;background:#ffaa00;transform:translateX(-50%)"></div><div style="position:absolute;bottom:0;left:50%;width:1px;height:4px;background:#ffaa00;transform:translateX(-50%)"></div><div style="position:absolute;left:0;top:50%;width:4px;height:1px;background:#ffaa00;transform:translateY(-50%)"></div><div style="position:absolute;right:0;top:50%;width:4px;height:1px;background:#ffaa00;transform:translateY(-50%)"></div></div>`,iconSize:[24,24]});playerRef.current=L.marker([location.lat,location.lon],{icon,zIndexOffset:1000}).addTo(map)}
},[location]);

useEffect(()=>{
if(!leafletRef.current)return;
const map=leafletRef.current;

// Build current items
const itemGroups={
aircraft:data.aircraft.map(a=>({id:"ac_"+a.icao,lat:a.lat,lon:a.lon,color:"#ff3355",shape:"triangle",key:"aircraft"})),
train:data.trains.map(t=>({id:t.id,lat:t.lat,lon:t.lon,color:"#aa44ff",shape:"square",key:"train"})),
cell:data.cells.slice(0,20).map(c=>({id:c.id,lat:c.lat,lon:c.lon,color:"#ffaa00",shape:"square",key:"cell"})),
wifi:data.wifi.slice(0,30).map(w=>({id:"w_"+w.id,lat:w.lat,lon:w.lon,color:"#00ff88",shape:"circle",r:3,key:"wifi"})),
bt:data.bt.slice(0,30).map(b=>({id:"b_"+b.id,lat:b.lat,lon:b.lon,color:"#00aaff",shape:"circle",r:3,key:"bt"})),
meshtastic:data.meshtastic.map(m=>({id:"m_"+m.id,lat:m.lat,lon:m.lon,color:"#00ffdd",shape:"circle",r:6,key:"meshtastic"})),
poke:data.portals.map(p=>({id:"p_"+p.id,lat:p.lat,lon:p.lon,color:"#ffdd00",shape:"diamond",key:"poke"})),
starlink:data.starlink.map(s=>({id:"sl_"+s.satid,lat:s.satlat,lon:s.satlng,color:"#88aaff",shape:"circle",r:3,key:"starlink"})),
};

const all=Object.entries(itemGroups).flatMap(([key,items])=>layers[key]?items:[]);
const seenIds=new Set();

all.forEach(item=>{
if(!item.lat||!item.lon)return;
seenIds.add(item.id);

// Update trail history
if(!trailHistoryRef.current[item.id])trailHistoryRef.current[item.id]=[];
const hist=trailHistoryRef.current[item.id];
const last=hist[hist.length-1];
if(!last||Math.abs(last[0]-item.lat)>0.0001||Math.abs(last[1]-item.lon)>0.0001){
hist.push([item.lat,item.lon]);
if(hist.length>50)hist.shift();
}

// Draw/update trail
if(trailLayers[item.key]&&hist.length>1){
if(trailsRef.current[item.id]){
trailsRef.current[item.id].setLatLngs(hist);
}else{
trailsRef.current[item.id]=L.polyline(hist,{color:item.color,weight:1,opacity:0.5,smoothFactor:1}).addTo(map);
}
}else if(trailsRef.current[item.id]&&!trailLayers[item.key]){
trailsRef.current[item.id].remove();
delete trailsRef.current[item.id];
}

// Draw/update marker
if(!markersRef.current[item.id]){
const r=item.r||5;
let html;
if(item.shape==="diamond")html=`<div style="width:8px;height:8px;background:${item.color};transform:rotate(45deg);box-shadow:0 0 6px ${item.color};margin:-4px 0 0 -4px"></div>`;
else if(item.shape==="triangle")html=`<div style="width:14px;height:14px;margin:-7px 0 0 -7px;transform:rotate(${item.heading||0}deg)"><svg viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><polygon points="7,0 9,5 14,6 9,7 10,14 7,11 4,14 5,7 0,6 5,5" fill="${item.color}" style="filter:drop-shadow(0 0 3px ${item.color})"/></svg></div>`;
else if(item.shape==="square")html=`<div style="width:8px;height:8px;background:${item.color};box-shadow:0 0 5px ${item.color};margin:-4px 0 0 -4px"></div>`;
else html=`<div style="width:${r*2}px;height:${r*2}px;background:${item.color};border-radius:50%;box-shadow:0 0 5px ${item.color};margin:-${r}px 0 0 -${r}px"></div>`;
const icon=L.divIcon({className:"",html});
markersRef.current[item.id]=L.marker([item.lat,item.lon],{icon}).addTo(map);
}else{
markersRef.current[item.id].setLatLng([item.lat,item.lon]);
}
});

Object.keys(markersRef.current).forEach(id=>{
if(!seenIds.has(id)){
markersRef.current[id].remove();
delete markersRef.current[id];
if(trailsRef.current[id]){trailsRef.current[id].remove();delete trailsRef.current[id]}
}
});
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
const[toasts,setToasts]=useState([]);
const[score,setScore]=useState(0);
const[tab,setTab]=useState("MAP");
const[layers,setLayers]=useState({wifi:true,bt:true,cell:true,aircraft:true,train:true,meshtastic:true,starlink:true,ham:true,poke:true});
const[trailLayers,setTrailLayers]=useState({wifi:false,bt:false,cell:false,aircraft:false,train:false,meshtastic:false,starlink:false,poke:false});
const[scanning,setScanning]=useState(false);
const[scanCount,setScanCount]=useState(getScanCount());
const tid=useRef(0);
const seen=useRef(new Set());
const toggleLayer=(key)=>setLayers(l=>({...l,[key]:!l[key]}));
const toggleTrail=(key)=>setTrailLayers(l=>({...l,[key]:!l[key]}));

useEffect(()=>{if(!navigator.geolocation)return;navigator.geolocation.watchPosition(p=>setLocation({lat:p.coords.latitude,lon:p.coords.longitude}),e=>console.error(e),{enableHighAccuracy:true})},[]);
useEffect(()=>{if(!location)return;const go=async()=>{const{lat,lon}=location;try{const r=await fetch(`https://opensky-network.org/api/states/all?lamin=${lat-0.5}&lomin=${lon-0.5}&lamax=${lat+0.5}&lomax=${lon+0.5}`);const d=await r.json();const planes=(d.states||[]).map(s=>({icao:s[0],callsign:(s[1]||s[0]).trim(),lon:s[5],lat:s[6],alt:s[7],heading:s[10]})).filter(p=>p.lat&&p.lon);planes.forEach(p=>{if(!seen.current.has(p.icao)){seen.current.add(p.icao);const pts=p.alt>10000?30:p.alt>3000?55:80;const id=tid.current++;setScore(s=>s+pts);setToasts(t=>[...t,{id,msg:`AIRCRAFT ${p.callsign}`,pts:`+${pts}`,color:"#ff3355"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setAircraft(planes)}catch(e){console.error(e)}};go();const iv=setInterval(go,15000);return()=>clearInterval(iv)},[location]);
useEffect(()=>{if(!location)return;const go=async()=>{const{lat,lon}=location;const d=1.5;const query=`[out:json];node["railway"="station"](${lat-d},${lon-d},${lat+d},${lon+d});out;`;try{const r=await fetch(`https://overpass-api.de/api/interpreter`,{method:"POST",body:`data=${encodeURIComponent(query)}`});const data=await r.json();const stations=(data.elements||[]).map(e=>({id:"osm_"+e.id,name:e.tags?.name||"STATION",lat:e.lat,lon:e.lon}));stations.forEach(s=>{if(!seen.current.has("train_"+s.id)){seen.current.add("train_"+s.id);const id=tid.current++;setScore(sc=>sc+20);setToasts(t=>[...t,{id,msg:`RAIL ${s.name}`,pts:"+20",color:"#aa44ff"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setTrains(stations)}catch(e){console.error(e)}};go();const iv=setInterval(go,60000);return()=>clearInterval(iv)},[location]);
useEffect(()=>{if(!location)return;const go=async()=>{const{lat,lon}=location;const d=0.5;const query=`[out:json];node["man_made"="mast"](${lat-d},${lon-d},${lat+d},${lon+d});out;`;try{const r=await fetch(`https://overpass-api.de/api/interpreter`,{method:"POST",body:`data=${encodeURIComponent(query)}`});const data=await r.json();const towers=(data.elements||[]).slice(0,20).map(e=>({id:"cell_"+e.id,name:e.tags?.operator||e.tags?.name||"CELL TOWER",lat:e.lat,lon:e.lon}));towers.forEach(t=>{if(!seen.current.has("cell_"+t.id)){seen.current.add("cell_"+t.id);const id=tid.current++;setScore(s=>s+25);setToasts(ts=>[...ts,{id,msg:`CELL ${t.name}`,pts:"+25",color:"#ffaa00"}]);setTimeout(()=>setToasts(ts=>ts.filter(x=>x.id!==id)),3200)}});setCells(towers)}catch(e){console.error(e)}};go();const iv=setInterval(go,60000);return()=>clearInterval(iv)},[location]);
useEffect(()=>{if(!location)return;const go=async()=>{const{lat,lon}=location;const d=0.05;const query=`[out:json];(node["tourism"~"artwork|attraction|museum|viewpoint"]["name"](${lat-d},${lon-d},${lat+d},${lon+d});node["historic"]["name"](${lat-d},${lon-d},${lat+d},${lon+d});node["amenity"~"place_of_worship|library|fountain"]["name"](${lat-d},${lon-d},${lat+d},${lon+d}););out;`;try{const r=await fetch(`https://overpass-api.de/api/interpreter`,{method:"POST",body:`data=${encodeURIComponent(query)}`});const data=await r.json();const pois=(data.elements||[]).map(e=>({id:"poi_"+e.id,name:e.tags?.name||"PORTAL",lat:e.lat,lon:e.lon}));pois.forEach(p=>{if(!seen.current.has("portal_"+p.id)){seen.current.add("portal_"+p.id);const id=tid.current++;setScore(s=>s+10);setToasts(t=>[...t,{id,msg:`PORTAL ${p.name.substring(0,20)}`,pts:"+10",color:"#ffdd00"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setPortals(pois)}catch(e){console.error(e)}};go();const iv=setInterval(go,45000);return()=>clearInterval(iv)},[location]);
useEffect(()=>{if(!location)return;const go=async()=>{const{lat,lon}=location;try{const r=await fetch(`https://meshtastic.liamcottle.net/api/v1/nodes?limit=100`);const d=await r.json();const nodes=(d.nodes||[]).filter(n=>n.latitude&&n.longitude).map(n=>({id:n.node_id,name:n.long_name||n.short_name||"MESH",lat:n.latitude>1000000?n.latitude/1e7:n.latitude,lon:n.longitude>1000000?n.longitude/1e7:n.longitude})).filter(n=>Math.abs(n.lat-lat)<1&&Math.abs(n.lon-lon)<1);nodes.forEach(n=>{if(!seen.current.has("mesh_"+n.id)){seen.current.add("mesh_"+n.id);const id=tid.current++;setScore(s=>s+40);setToasts(t=>[...t,{id,msg:`MESH ${n.name}`,pts:"+40",color:"#00ffdd"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setMeshtastic(nodes)}catch(e){console.error(e)}};go();const iv=setInterval(go,30000);return()=>clearInterval(iv)},[location]);
useEffect(()=>{if(!location)return;const go=async()=>{const{lat,lon}=location;try{const r=await fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=starlink`);const d=await r.json();const sats=(d.above||[]).slice(0,20);sats.forEach(s=>{if(!seen.current.has("sl_"+s.satid)){seen.current.add("sl_"+s.satid);const id=tid.current++;setScore(sc=>sc+15);setToasts(t=>[...t,{id,msg:`STARLINK ${s.satname}`,pts:"+15",color:"#88aaff"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200)}});setStarlink(sats)}catch(e){console.error(e)}};go();const iv=setInterval(go,30000);return()=>clearInterval(iv)},[location]);

const doScan=async()=>{
if(!location||scanning)return;
const count=getScanCount();
if(count>=MAX_DAILY_SCANS){const id=tid.current++;setToasts(t=>[...t,{id,msg:`SCAN LIMIT · ${MAX_DAILY_SCANS}/day`,pts:"",color:"#ff3355"}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200);return}
setScanning(true);incScanCount();setScanCount(getScanCount());
const{lat,lon}=location;const d=0.001;
try{
const[wRes,bRes]=await Promise.all([fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=wifi`),fetch(`${PROXY}/?lat=${lat}&lon=${lon}&type=bt`)]);
const[wData,bData]=await Promise.all([wRes.json(),bRes.json()]);
const nets=(wData.results||[]).filter(n=>n.ssid&&n.trilat&&n.trilong&&Math.abs(n.trilat-lat)<d&&Math.abs(n.trilong-lon)<d).map(n=>({id:n.netid,ssid:n.ssid,lat:n.trilat,lon:n.trilong}));
const devs=(bData.results||[]).filter(n=>n.trilat&&n.trilong&&Math.abs(n.trilat-lat)<d&&Math.abs(n.trilong-lon)<d).map(n=>({id:n.netid,name:n.ssid||"BT DEVICE",lat:n.trilat,lon:n.trilong}));
let newPts=0;
nets.forEach(n=>{if(!seen.current.has("wifi_"+n.id)){seen.current.add("wifi_"+n.id);const pts=Math.floor(Math.random()*11)+5;newPts+=pts;setScore(s=>s+pts)}});
devs.forEach(n=>{if(!seen.current.has("bt_"+n.id)){seen.current.add("bt_"+n.id);const pts=Math.floor(Math.random()*16)+5;newPts+=pts;setScore(s=>s+pts)}});
setWifi(w=>[...w,...nets.filter(n=>!w.find(x=>x.id===n.id))]);
setBt(b=>[...b,...devs.filter(n=>!b.find(x=>x.id===n.id))]);
const id=tid.current++;setToasts(t=>[...t,{id,msg:`SCAN · ${nets.length} WIFI · ${devs.length} BT`,pts:newPts>0?`+${newPts}`:"",color:"#00ff88"}]);
setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200);
}catch(e){console.error(e)}
setScanning(false);
};

const data={aircraft,trains,cells,wifi,bt,meshtastic,portals,starlink};
const scansLeft=MAX_DAILY_SCANS-scanCount;
if(tab==="TPMS")return<div style={{height:"100vh"}}><TPMSOperator setTab={setTab}/></div>;
return(
<div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#050a08",color:"#a0c8b0",fontFamily:"Courier New,monospace",fontSize:12,overflow:"hidden"}}>
<div style={{position:"fixed",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)",pointerEvents:"none",zIndex:998}}/>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",borderBottom:"1px solid #1a3025",background:"#080f0b",flexShrink:0,zIndex:10,position:"relative"}}>
<div style={{fontWeight:900,fontSize:13,letterSpacing:4,color:"#00ff88",textShadow:"0 0 16px #00ff88"}}>MISSION <span style={{color:"#ffaa00"}}>OPR</span></div>
<div style={{fontSize:9}}>{location?<span style={{color:"#00ff88"}}>{location.lat.toFixed(4)}° {location.lon.toFixed(4)}°</span>:<span style={{color:"#ffaa00"}}>ACQUIRING GPS...</span>}</div>
<div style={{fontWeight:900,fontSize:14,color:"#ffaa00"}}>{score.toLocaleString()} PTS</div>
</div>
<div style={{display:"grid",gridTemplateColumns:"145px 1fr",flex:1,overflow:"hidden",position:"relative"}}>
<div style={{borderRight:"1px solid #1a3025",background:"#080f0b",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",zIndex:10}}>
<div style={{fontSize:8,letterSpacing:3,color:"#00ff88",padding:"6px 8px",borderBottom:"1px solid #1a3025"}}>{"//"} SIGNALS</div>
<div style={{flex:1,overflowY:"auto",padding:4,display:"flex",flexDirection:"column",gap:3}}>
{SIGNAL_TYPES.map(s=>{
const count=s.key==="aircraft"?aircraft.length:s.key==="train"?trains.length:s.key==="cell"?cells.length:s.key==="wifi"?wifi.length:s.key==="bt"?bt.length:s.key==="meshtastic"?meshtastic.length:s.key==="poke"?portals.length:s.key==="starlink"?starlink.length:0;
const on=layers[s.key]!==false;
const trail=trailLayers[s.key]||false;
const isManual=s.key==="wifi"||s.key==="bt";
return(<div key={s.key} style={{background:"#0a140e",border:`1px solid ${on?"#1a3025":"#0d1510"}`,borderLeft:`3px solid ${on?s.color:"#1a3025"}`,borderRadius:3,padding:"3px 6px",position:"relative",opacity:on?1:0.4}}>
<div style={{fontWeight:700,fontSize:8,color:on?"#fff":"#4a7a5a"}}>{s.label}{isManual&&<span style={{fontSize:6,color:"#4a7a5a",marginLeft:3}}>M</span>}</div>
<div style={{fontSize:6,color:on?s.color:"#1a3025"}}>{s.pts}</div>
<div style={{position:"absolute",right:34,top:"50%",transform:"translateY(-50%)",fontWeight:700,fontSize:9,color:on?s.color:"#1a3025"}}>{count}</div>
<div onClick={()=>toggleTrail(s.key)} style={{position:"absolute",right:18,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:8,opacity:trail?1:0.25,lineHeight:1}} title="trail">〰</div>
<div onClick={()=>toggleLayer(s.key)} style={{position:"absolute",right:3,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:on?"#ff3355":"#4a7a5a",fontSize:9,fontWeight:900,lineHeight:1}}>✕</div>
</div>);})}
</div>
<div style={{borderTop:"1px solid #1a3025",padding:6}}>
{[["SCORE",score.toLocaleString(),"#ffaa00"],["AIR",aircraft.length,"#ff3355"],["RAIL",trains.length,"#aa44ff"],["CELL",cells.length,"#ffaa00"],["MESH",meshtastic.length,"#00ffdd"],["PORTAL",portals.length,"#ffdd00"],["STAR",starlink.length,"#88aaff"],["WIFI",wifi.length,"#00ff88"],["BT",bt.length,"#00aaff"],["GPS",location?"LOCK":"SRCH",location?"#00ff88":"#ffaa00"]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"1px 0",borderBottom:"1px solid #0d1f14",fontSize:8}}><span style={{color:"#4a7a5a"}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}</span></div>))}
</div>
</div>
<div style={{position:"relative",overflow:"hidden"}}>
<TopoMap location={location} layers={layers} trailLayers={trailLayers} data={data}/>
<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:2}}>
<circle cx="190" cy="155" r="80" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="5,7" opacity="0.25"/>
<circle cx="190" cy="155" r="40" fill="none" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="3,5" opacity="0.15"/>
</svg>
<div style={{position:"absolute",bottom:45,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:3,alignItems:"center",width:180,pointerEvents:"none",zIndex:3}}>
{toasts.map(t=>(<div key={t.id} style={{background:"rgba(0,10,6,0.5)",border:`1px solid ${t.color}`,borderLeft:`3px solid ${t.color}`,padding:"3px 7px",fontSize:7,color:"#fff",borderRadius:2,width:"100%",display:"flex",justifyContent:"space-between",backdropFilter:"blur(4px)"}}><span>{t.msg}</span><span style={{color:t.color,fontWeight:700,marginLeft:6}}>{t.pts}</span></div>))}
</div>
{!location&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#ffaa00",fontSize:11,letterSpacing:2,textAlign:"center",zIndex:3,background:"rgba(0,0,0,0.7)",padding:"12px 20px",borderRadius:4}}>ACQUIRING GPS<br/><span style={{fontSize:8,color:"#4a7a5a"}}>ALLOW LOCATION ACCESS</span></div>}
<div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",fontSize:8,letterSpacing:4,color:"#00ff88",opacity:0.7,zIndex:3,textShadow:"0 0 8px #00ff88",background:"rgba(0,0,0,0.4)",padding:"2px 8px",borderRadius:2}}>SCANNING</div>
</div>
</div>
<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 10px",borderTop:"1px solid #1a3025",background:"#080f0b",flexShrink:0,position:"relative",zIndex:10}}>
<div style={{display:"flex",gap:2}}>
{["MAP","LOG","BADGES","TPMS","SET"].map(t=>(<div key={t} onClick={()=>setTab(t)} style={{fontSize:8,letterSpacing:1,padding:"3px 6px",cursor:"pointer",borderRadius:2,color:tab===t?"#00ff88":"#4a7a5a",border:`1px solid ${tab===t?"#00ff88":"transparent"}`}}>{t}</div>))}
</div>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:7,color:scansLeft<5?"#ff3355":"#4a7a5a"}}>{scansLeft}/{MAX_DAILY_SCANS}</span>
<button onClick={doScan} disabled={scanning||scansLeft<=0} style={{background:"transparent",border:`1px solid ${scanning?"#ffaa00":scansLeft<=0?"#ff3355":"#00ff88"}`,color:scanning?"#ffaa00":scansLeft<=0?"#ff3355":"#00ff88",fontFamily:"monospace",fontSize:8,letterSpacing:2,padding:"3px 10px",cursor:scansLeft<=0?"not-allowed":"pointer",borderRadius:2}}>
{scanning?"SCANNING...":scansLeft<=0?"LIMIT":"[ SCAN ]"}
</button>
</div>
</div>
</div>
);}
