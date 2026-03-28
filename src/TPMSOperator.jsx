import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";

const MOTION_COLOR={APPROACHING:"#ff3355",RECEDING:"#4a7a5a",PACING:"#ffaa00",STATIC:"#4a7a5a"};
const NUS_SERVICE="8fe5b3d5-2e7f-4a98-2a48-7acc60fe0000";
const NUS_TX="19ed82ae-ed21-4c9d-4145-228e61fe0000";
const NUS_RX="19ed82ae-ed21-4c9d-4145-228e61fe0000";

const inferVehicleClass=(protocol,pressure)=>{
if(!protocol&&!pressure)return{label:"UNKNOWN",color:"#4a7a5a",pts:10};
const p=(protocol||"").toLowerCase();
const psi=pressure||0;
if(psi>90)return{label:"SEMI/TRUCK",color:"#ff8800",pts:50};
if(psi>50)return{label:"LIGHT TRUCK",color:"#ffaa00",pts:35};
if(p.includes("continental"))return{label:"EURO VEHICLE",color:"#00aaff",pts:30};
if(p.includes("schrader"))return{label:"US PASSENGER",color:"#00ff88",pts:20};
if(p.includes("pacific")||p.includes("huf"))return{label:"IMPORT",color:"#00ffdd",pts:25};
return{label:"PASSENGER",color:"#00ff88",pts:20};
};

const inferMotion=(d)=>{
if(d.length<2)return"STATIC";
const dR=(d[d.length-1].rssi||-70)-(d[d.length-2].rssi||-70);
if(Math.abs(dR)<3)return"PACING";
return dR>0?"APPROACHING":"RECEDING";
};

function TPMSMap({location,vehicles}){
const mapRef=useRef(null);
const leafletRef=useRef(null);
const markersRef=useRef({});
const playerRef=useRef(null);

useEffect(()=>{
if(!mapRef.current||leafletRef.current)return;
const map=L.map(mapRef.current,{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,keyboard:false,touchZoom:true});
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
else{
const icon=L.divIcon({className:"",html:`<div style="position:relative;width:24px;height:24px;margin:-12px 0 0 -12px"><div style="position:absolute;inset:0;border:2px solid #ffaa00;border-radius:50%;box-shadow:0 0 12px #ffaa00"></div><div style="position:absolute;top:50%;left:50%;width:6px;height:6px;background:#ffaa00;border-radius:50%;transform:translate(-50%,-50%)"></div><div style="position:absolute;top:0;left:50%;width:1px;height:4px;background:#ffaa00;transform:translateX(-50%)"></div><div style="position:absolute;bottom:0;left:50%;width:1px;height:4px;background:#ffaa00;transform:translateX(-50%)"></div><div style="position:absolute;left:0;top:50%;width:4px;height:1px;background:#ffaa00;transform:translateY(-50%)"></div><div style="position:absolute;right:0;top:50%;width:4px;height:1px;background:#ffaa00;transform:translateY(-50%)"></div></div>`,iconSize:[24,24]});
playerRef.current=L.marker([location.lat,location.lon],{icon,zIndexOffset:1000}).addTo(map);
}
},[location]);

useEffect(()=>{
if(!leafletRef.current)return;
const map=leafletRef.current;
const seenIds=new Set();
Object.values(vehicles).forEach(v=>{
const d=v.detections[v.detections.length-1];
if(!d?.lat||!d?.lon)return;
seenIds.add(v.sensorId);
const active=Date.now()-v.lastSeen<30000;
const col=active?v.vehicleClass.color:"#4a7a5a";
if(!markersRef.current[v.sensorId]){
const icon=L.divIcon({className:"",html:`<div style="width:10px;height:10px;background:${col};border-radius:50%;box-shadow:0 0 8px ${col};margin:-5px 0 0 -5px"></div>`});
markersRef.current[v.sensorId]=L.marker([d.lat,d.lon],{icon}).addTo(map);
}else{markersRef.current[v.sensorId].setLatLng([d.lat,d.lon])}
});
Object.keys(markersRef.current).forEach(id=>{if(!seenIds.has(id)){markersRef.current[id].remove();delete markersRef.current[id]}});
},[vehicles]);

return<div ref={mapRef} style={{position:"absolute",inset:0,zIndex:0}}/>;
}

export default function TPMSOperator({setTab}){
const[location,setLocation]=useState(null);
const[vehicles,setVehicles]=useState({});
const[rawLog,setRawLog]=useState([]);
const[toasts,setToasts]=useState([]);
const[score,setScore]=useState(0);
const[localTab,setLocalTab]=useState("MAP");
const[flipperConn,setFlipperConn]=useState(false);
const[status,setStatus]=useState("DISCONNECTED");
const[sessionStats,setSessionStats]=useState({totalVehicles:0,peakDensity:0});
const tid=useRef(0);
const deviceRef=useRef(null);
const txCharRef=useRef(null);
const bufRef=useRef("");

useEffect(()=>{
if(!navigator.geolocation)return;
navigator.geolocation.watchPosition(
p=>setLocation({lat:p.coords.latitude,lon:p.coords.longitude}),
e=>console.error(e),
{enableHighAccuracy:true}
);
},[]);

const parseLine=useCallback((line)=>{
console.log("FLIPPER LINE:",line);
// Try to parse TPMS data from various Flipper output formats
// Format 1: sensor_id=XXXX pressure=XX temperature=XX rssi=XX battery=OK
// Format 2: Flipper subghz raw decoded output
const sensorMatch=line.match(/(?:sensor_id|id)[=:\s]+([0-9a-fA-F]+)/i);
const pressureMatch=line.match(/pressure[=:\s]+(\d+\.?\d*)/i);
const tempMatch=line.match(/temp(?:erature)?[=:\s]+(-?\d+\.?\d*)/i);
const rssiMatch=line.match(/rssi[=:\s]+(-?\d+)/i);
const battMatch=line.match(/battery[=:\s]+(low|ok|good)/i);
const protoMatch=line.match(/protocol[=:\s]+([a-zA-Z0-9_]+)/i);

if(!sensorMatch)return;
const sensorId=sensorMatch[1].toLowerCase();
const pressure=pressureMatch?parseFloat(pressureMatch[1]):null;
const temperature=tempMatch?parseFloat(tempMatch[1]):null;
const rssi=rssiMatch?parseInt(rssiMatch[1]):null;
const battery=battMatch?battMatch[1].toUpperCase():null;
const protocol=protoMatch?protoMatch[1]:null;

const entry={sensorId,pressure,temperature,rssi,battery,protocol,time:new Date().toLocaleTimeString(),lat:null,lon:null};
if(location){entry.lat=location.lat+(Math.random()-0.5)*0.002;entry.lon=location.lon+(Math.random()-0.5)*0.002}
const vehicleClass=inferVehicleClass(protocol,pressure);
entry.vehicleClass=vehicleClass;
setRawLog(l=>[entry,...l.slice(0,199)]);
setVehicles(prev=>{
const existing=prev[sensorId]||{sensorId,detections:[],vehicleClass,lastSeen:0,motionState:"STATIC"};
const updated={...existing,detections:[...existing.detections.slice(-19),entry],lastSeen:Date.now(),vehicleClass,motionState:inferMotion([...existing.detections,entry])};
const isNew=!prev[sensorId];
if(isNew){
const pts=vehicleClass.pts;
const id=tid.current++;
setScore(s=>s+pts);
setToasts(t=>[...t,{id,msg:`TPMS ${sensorId.slice(-4).toUpperCase()}`,pts:`+${pts}`,color:vehicleClass.color,sub:`${vehicleClass.label}${pressure?` · ${pressure} PSI`:""}`}]);
setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3200);
setSessionStats(s=>({totalVehicles:s.totalVehicles+1,peakDensity:Math.max(s.peakDensity,Object.keys(prev).length+1)}));
}
return{...prev,[sensorId]:updated};
});
},[location]);

const connectFlipper=async()=>{
try{
if(!navigator.bluetooth){setStatus("WEB BLUETOOTH NOT SUPPORTED");return}
setStatus("SCANNING...");
const device=await navigator.bluetooth.requestDevice({
filters:[{namePrefix:"Flipper"},{services:[NUS_SERVICE]}],
optionalServices:[NUS_SERVICE]
});
setStatus("CONNECTING...");
const server=await device.gatt.connect();
const service=await server.getPrimaryService(NUS_SERVICE);
const tx=await service.getCharacteristic(NUS_TX);
const rx=await service.getCharacteristic(NUS_RX);
txCharRef.current=rx;
deviceRef.current=device;
await tx.startNotifications();
tx.addEventListener("characteristicvaluechanged",(e)=>{
const chunk=new TextDecoder().decode(e.target.value);
bufRef.current+=chunk;
const lines=bufRef.current.split("\n");
bufRef.current=lines.pop();
lines.forEach(l=>l.trim()&&parseLine(l.trim()));
});
// Send subghz rx command
const cmd=new TextEncoder().encode("subghz rx 433920000\r\n");
await rx.writeValue(cmd);
setFlipperConn(true);
setStatus("FLIPPER LINKED · 433.92MHz");
device.addEventListener("gattserverdisconnected",()=>{
setFlipperConn(false);
setStatus("DISCONNECTED");
});
}catch(e){
console.error(e);
setStatus("ERROR: "+e.message);
setFlipperConn(false);
}
};

const disconnectFlipper=async()=>{
try{
if(txCharRef.current){
const stop=new TextEncoder().encode("\x03\r\n");
await txCharRef.current.writeValue(stop);
}
if(deviceRef.current?.gatt?.connected)deviceRef.current.gatt.disconnect();
}catch(e){console.error(e)}
setFlipperConn(false);
setStatus("DISCONNECTED");
deviceRef.current=null;
txCharRef.current=null;
};

const vehicleList=Object.values(vehicles).sort((a,b)=>b.lastSeen-a.lastSeen);
const activeVehicles=vehicleList.filter(v=>Date.now()-v.lastSeen<30000);

return(
<div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#050a08",color:"#a0c8b0",fontFamily:"Courier New,monospace",fontSize:12,overflow:"hidden"}}>
<div style={{position:"fixed",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)",pointerEvents:"none",zIndex:998}}/>

<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",borderBottom:"1px solid #1a3025",background:"#080f0b",flexShrink:0,zIndex:10,position:"relative"}}>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<button onClick={()=>setTab&&setTab("MAP")} style={{background:"transparent",border:"1px solid #1a3025",color:"#4a7a5a",fontFamily:"monospace",fontSize:8,padding:"2px 6px",cursor:"pointer",borderRadius:2}}>← MAP</button>
<div style={{fontWeight:900,fontSize:13,letterSpacing:4,color:"#00ff88",textShadow:"0 0 16px #00ff88"}}>TPMS <span style={{color:"#ffaa00"}}>OPR</span></div>
</div>
<div style={{fontSize:7,color:flipperConn?"#00ff88":"#ff3355",letterSpacing:1,textAlign:"center"}}>{status}</div>
<button onClick={flipperConn?disconnectFlipper:connectFlipper} style={{background:"transparent",border:`1px solid ${flipperConn?"#ff3355":"#00ff88"}`,color:flipperConn?"#ff3355":"#00ff88",fontFamily:"monospace",fontSize:8,letterSpacing:1,padding:"2px 8px",cursor:"pointer",borderRadius:2}}>
{flipperConn?"DISCONNECT":"CONNECT"}
</button>
</div>

<div style={{display:"grid",gridTemplateColumns:"145px 1fr",flex:1,overflow:"hidden",position:"relative"}}>
<div style={{borderRight:"1px solid #1a3025",background:"#080f0b",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",zIndex:10}}>
<div style={{fontSize:8,letterSpacing:3,color:"#00ff88",padding:"6px 8px",borderBottom:"1px solid #1a3025"}}>{"//"} VEHICLES</div>
<div style={{flex:1,overflowY:"auto",padding:5,display:"flex",flexDirection:"column",gap:4}}>
{vehicleList.map(v=>{
const latest=v.detections[v.detections.length-1];
const active=Date.now()-v.lastSeen<30000;
return(
<div key={v.sensorId} style={{background:"#0a140e",border:"1px solid #1a3025",borderLeft:`3px solid ${active?v.vehicleClass.color:"#1a3025"}`,borderRadius:3,padding:"5px 8px",opacity:active?1:0.4}}>
<div style={{display:"flex",justifyContent:"space-between"}}>
<div style={{fontWeight:700,fontSize:10,color:"#fff"}}>{v.sensorId.slice(-6).toUpperCase()}</div>
<div style={{fontSize:7,color:MOTION_COLOR[v.motionState]}}>{v.motionState}</div>
</div>
<div style={{fontSize:7,color:v.vehicleClass.color,marginTop:1}}>{v.vehicleClass.label}</div>
<div style={{display:"flex",gap:6,marginTop:2}}>
{latest?.pressure&&<span style={{fontSize:7,color:"#4a7a5a"}}>{latest.pressure} PSI</span>}
{latest?.temperature&&<span style={{fontSize:7,color:"#4a7a5a"}}>{latest.temperature}°C</span>}
<span style={{fontSize:7,color:"#4a7a5a"}}>{v.detections.length} hits</span>
</div>
</div>
);
})}
{vehicleList.length===0&&(
<div style={{color:"#4a7a5a",fontSize:9,textAlign:"center",marginTop:20,letterSpacing:2}}>
{flipperConn?"SCANNING FOR TPMS...":"TAP CONNECT TO START"}
</div>
)}
</div>
<div style={{borderTop:"1px solid #1a3025",padding:8}}>
{[["SCORE",score.toLocaleString(),"#ffaa00"],["ACTIVE",activeVehicles.length,"#00ff88"],["TOTAL",sessionStats.totalVehicles,"#00ffdd"],["PEAK",sessionStats.peakDensity,"#ff8800"],["GPS",location?"LOCK":"SEARCH",location?"#00ff88":"#ffaa00"]].map(([l,v,c])=>(
<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:"1px solid #0d1f14",fontSize:9}}>
<span style={{color:"#4a7a5a"}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}</span>
</div>
))}
</div>
</div>

<div style={{position:"relative",overflow:"hidden"}}>
<TPMSMap location={location} vehicles={vehicles}/>
<div style={{position:"absolute",bottom:45,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:4,alignItems:"center",width:200,pointerEvents:"none",zIndex:3}}>
{toasts.map(t=>(
<div key={t.id} style={{background:"rgba(0,10,6,0.5)",border:`1px solid ${t.color}`,borderLeft:`3px solid ${t.color}`,padding:"3px 8px",fontSize:8,color:"#fff",borderRadius:2,width:"100%",backdropFilter:"blur(4px)"}}>
<div style={{display:"flex",justifyContent:"space-between"}}><span>{t.msg}</span><span style={{color:t.color,fontWeight:700}}>{t.pts}</span></div>
{t.sub&&<div style={{color:t.color,fontSize:7,marginTop:1}}>{t.sub}</div>}
</div>
))}
</div>
{!location&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:"#ffaa00",fontSize:11,letterSpacing:2,textAlign:"center",zIndex:3,background:"rgba(0,0,0,0.7)",padding:"12px 20px",borderRadius:4}}>ACQUIRING GPS<br/><span style={{fontSize:8,color:"#4a7a5a"}}>ALLOW LOCATION ACCESS</span></div>}
</div>
</div>

<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 10px",borderTop:"1px solid #1a3025",background:"#080f0b",flexShrink:0,position:"relative",zIndex:10}}>
<div style={{display:"flex",gap:2}}>
{["MAP","LOG","LEGEND"].map(t=>(<div key={t} onClick={()=>setLocalTab(t)} style={{fontSize:8,letterSpacing:1,padding:"3px 6px",cursor:"pointer",borderRadius:2,color:localTab===t?"#00ff88":"#4a7a5a",border:`1px solid ${localTab===t?"#00ff88":"transparent"}`}}>{t}</div>))}
</div>
{localTab==="LOG"&&(
<div style={{position:"absolute",bottom:32,left:145,right:0,background:"#080f0b",border:"1px solid #1a3025",borderBottom:"none",maxHeight:150,overflowY:"auto",padding:6,zIndex:10}}>
<div style={{fontSize:8,letterSpacing:2,color:"#00ff88",marginBottom:4}}>{"// PACKET LOG"}</div>
{rawLog.map((r,i)=>(
<div key={i} style={{fontSize:7,color:"#4a7a5a",borderBottom:"1px solid #0d1f14",padding:"2px 0",display:"flex",gap:8}}>
<span>{r.time}</span>
<span style={{color:"#00ff88"}}>{r.sensorId?.slice(-6)}</span>
<span>{r.protocol||"?"}</span>
{r.pressure&&<span>{r.pressure} PSI</span>}
{r.temperature&&<span>{r.temperature}°C</span>}
</div>
))}
</div>
)}
{localTab==="LEGEND"&&(
<div style={{position:"absolute",bottom:32,left:145,right:0,background:"#080f0b",border:"1px solid #1a3025",borderBottom:"none",padding:8,zIndex:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
{[["SEMI/TRUCK","#ff8800",">90 PSI"],["LIGHT TRUCK","#ffaa00","50-90 PSI"],["EURO","#00aaff","Continental"],["US PASS","#00ff88","Schrader"],["IMPORT","#00ffdd","Pacific/Huf"],["APPROACHING","#ff3355","rising RSSI"],["PACING","#ffaa00","stable RSSI"],["RECEDING","#4a7a5a","falling RSSI"]].map(([l,c,note])=>(
<div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
<div style={{width:7,height:7,borderRadius:2,background:c,flexShrink:0}}/>
<div><div style={{fontSize:7,color:"#fff"}}>{l}</div><div style={{fontSize:6,color:"#4a7a5a"}}>{note}</div></div>
</div>
))}
</div>
)}
</div>
</div>
);
}
