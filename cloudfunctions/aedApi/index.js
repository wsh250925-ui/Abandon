const cloud=require('wx-server-sdk');
const https=require('https');
const crypto=require('crypto');
const {point,normalize,route}=require('./domain');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const requests=new Map();
function request(path,params) {
  return new Promise((resolve,reject)=>{
    const url=new URL('https://api.map.baidu.com'+path);
    Object.entries({...params,ak:process.env.BAIDU_MAP_AK,output:'json'}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
    const req=https.get(url,res=>{let body=''; res.setEncoding('utf8'); res.on('data',chunk=>{body+=chunk;if(body.length>2000000)req.destroy(new Error('UPSTREAM_SIZE'));});res.on('error',reject);res.on('end',()=>{try{if(res.statusCode!==200)throw new Error('UPSTREAM');const data=JSON.parse(body);if(Number(data.status)!==0)throw new Error('BAIDU_'+data.status);resolve(data);}catch(e){reject(e);}});});
    req.setTimeout(6500,()=>req.destroy(new Error('TIMEOUT')));req.on('error',reject);
  });
}
function sign(payload) {return crypto.createHmac('sha256',process.env.BAIDU_MAP_AK).update(payload).digest('hex');}
exports.main=async(event)=>{
  try {
    const {OPENID}=cloud.getWXContext(); if(!OPENID)throw new Error('UNAUTHORIZED');
    if(!process.env.BAIDU_MAP_AK)throw new Error('NOT_CONFIGURED');
    if(!['search','routes'].includes(event.action))throw new Error('INVALID_ACTION');
    const origin=point(event.origin), now=Date.now();
    // Per-instance burst guard; provider quotas remain the cross-instance spend limit.
    for(const [k,v] of requests)if(now-v>60000)requests.delete(k);
    if(requests.size>5000)throw new Error('BUSY');
    const key=OPENID+event.action;if(now-(requests.get(key)||0)<1200)throw new Error('TOO_FAST');requests.set(key,now);
    const coord=p=>`${p.latitude},${p.longitude}`;
    if(event.action==='search') {
      const radius=Number(event.radius);if(![1000,3000,5000].includes(radius))throw new Error('INVALID_RADIUS');
      const data=await request('/place/v2/search',{query:'AED$自动体外除颤器',location:coord(origin),radius,radius_limit:true,coord_type:2,ret_coordtype:'gcj02ll',scope:2,page_size:20,page_num:0,filter:'sort_name:distance|sort_rule:1'});
      const stations=normalize(data.results,origin,radius).map(p=>{const payload=JSON.stringify({uid:p.uid,latitude:p.latitude,longitude:p.longitude,openid:OPENID,expires:now+600000});return {...p,ticket:{payload,signature:sign(payload)}};});
      return {ok:true,stations,limited:Number(data.total)>stations.length};
    }
    const ticket=event.ticket;if(!ticket || typeof ticket.payload!=='string' || ticket.payload.length>1000 || ticket.signature!==sign(ticket.payload))throw new Error('INVALID_TICKET');
    const destination=JSON.parse(ticket.payload);if(destination.openid!==OPENID || destination.expires<now)throw new Error('EXPIRED');point(destination);
    const values=await Promise.all(['walking','driving'].map(async mode=>{try{return route(await request('/directionlite/v1/'+mode,{origin:coord(origin),destination:coord(destination),coord_type:'gcj02'}));}catch(_){return null;}}));
    return {ok:true,walking:values[0],driving:values[1]};
  }catch(e){const code=String(e.message||'UNKNOWN');return {ok:false,code:/^(NOT_CONFIGURED|UNAUTHORIZED|INVALID_\w+|EXPIRED|TOO_FAST|BUSY|TIMEOUT|BAIDU_\d+)$/.test(code)?code:'UPSTREAM'};}
};
