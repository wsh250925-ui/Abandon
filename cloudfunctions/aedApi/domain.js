function point(p) {
  if (!p || typeof p.latitude !== 'number' || typeof p.longitude !== 'number' || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude)>90 || Math.abs(p.longitude)>180) throw new Error('INVALID_LOCATION');
  return { latitude: p.latitude, longitude: p.longitude };
}
function distance(a,b) {
  const r=Math.PI/180, dlat=(b.latitude-a.latitude)*r, dlng=(b.longitude-a.longitude)*r;
  const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dlng/2)**2;
  return Math.round(6371000*2*Math.asin(Math.sqrt(Math.min(1,h))));
}
function normalize(rows, origin, radius) {
  const seen=new Set();
  return (rows||[]).reduce((out,x)=>{
    if (!x.uid || seen.has(x.uid) || !/AED|除颤/i.test(x.name||'')) return out;
    let p; try { p=point({latitude:x.location.lat,longitude:x.location.lng}); } catch (_) { return out; }
    const meters=distance(origin,p); if(meters>radius) return out;
    seen.add(x.uid); out.push({uid:x.uid,name:String(x.name).slice(0,150),address:String(x.address||'具体放置位置请向场所工作人员确认').slice(0,300),...p,distance:meters}); return out;
  },[]).sort((a,b)=>a.distance-b.distance).slice(0,40);
}
function route(data) { const r=data && data.result && data.result.routes && data.result.routes[0]; return r && Number.isFinite(r.duration) && r.duration>=0 && Number.isFinite(r.distance) ? {seconds:r.duration,meters:r.distance} : null; }
module.exports={point,distance,normalize,route};
