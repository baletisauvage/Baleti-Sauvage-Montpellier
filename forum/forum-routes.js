// Module de routes à intégrer au Worker principal, après vérification de session admin.
// DB : liaison D1 env.DB. Authentification admin : fournir isAdmin(request,env).
// Déploiement NON automatique : le Worker en production reste inchangé.
export async function forumRoute(request,env,isAdmin) {
 const url=new URL(request.url),p=url.pathname;
 if(p!=='/api/forum'&&p!=='/api/forum/admin'&&p!=='/api/forum/moderate') return null;
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://baletisauvage.github.io','Vary':'Origin'};
 const respond=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers});
 const now=Date.now(),ttl=72*60*60*1000;
 const origin=request.headers.get('Origin');
 if(origin&&origin!=='https://baletisauvage.github.io')return respond({ok:false,error:'Origine non autorisée'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Admin-Token'}});
 if(request.method==='GET'&&p==='/api/forum'){
  const rows=await env.DB.prepare('SELECT id,parent_id,nickname,body,created_at,expires_at FROM forum_posts WHERE hidden=0 AND expires_at>? ORDER BY created_at DESC LIMIT 100').bind(now).all();
  return respond({ok:true,posts:rows.results});
 }
 if(request.method==='POST'&&p==='/api/forum'){
  const raw=await request.text();if(raw.length>1600)return respond({ok:false,error:'Message trop long'},413);
  let data;try{data=JSON.parse(raw)}catch{return respond({ok:false,error:'JSON invalide'},400)}
  if(!data||typeof data!=='object'||Array.isArray(data))return respond({ok:false,error:'Message invalide'},400);
  const nickname=String(data.nickname||'').trim(),body=String(data.body||'').trim(),parent=String(data.parent_id||'');
  if(nickname.length<2||nickname.length>32||body.length<2||body.length>800||/[<>]/.test(nickname)||/[\\u0000-\\u001f\\u007f]/.test(nickname))return respond({ok:false,error:'Pseudo ou message invalide'},400);
  if(parent){const row=await env.DB.prepare('SELECT id FROM forum_posts WHERE id=? AND hidden=0 AND expires_at>? AND parent_id IS NULL').bind(parent,now).first();if(!row)return respond({ok:false,error:'Discussion expirée'},404)}
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':'+new Date().toISOString().slice(0,10)));
  const fingerprint=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const previous=await env.DB.prepare('SELECT last_post_at FROM forum_limits WHERE fingerprint=?').bind(fingerprint).first();
  if(previous&&now-previous.last_post_at<60000)return respond({ok:false,error:'Attendez une minute entre deux messages'},429);
  const expiry=parent?(await env.DB.prepare('SELECT expires_at FROM forum_posts WHERE id=?').bind(parent).first()).expires_at:now+ttl;
  const id=crypto.randomUUID();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO forum_posts(id,parent_id,nickname,body,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,parent||null,nickname,body,now,expiry),
   env.DB.prepare('INSERT INTO forum_limits(fingerprint,last_post_at) VALUES(?,?) ON CONFLICT(fingerprint) DO UPDATE SET last_post_at=excluded.last_post_at').bind(fingerprint,now)
  ]);
  return respond({ok:true,id,expires_at:expiry},201);
 }
 if(request.method==='GET'&&p==='/api/forum/admin'){
  if(!await isAdmin(request,env))return respond({ok:false,error:'Accès refusé'},403);
  const rows=await env.DB.prepare('SELECT id,parent_id,nickname,body,created_at,expires_at,hidden FROM forum_posts ORDER BY created_at DESC LIMIT 200').all();
  return respond({ok:true,posts:rows.results});
 }
 if(request.method==='POST'&&p==='/api/forum/moderate'){
  if(!await isAdmin(request,env))return respond({ok:false,error:'Accès refusé'},403);
  const raw=await request.text();if(raw.length>500)return respond({ok:false,error:'Requête trop longue'},413);
  let data;try{data=JSON.parse(raw)}catch{return respond({ok:false,error:'JSON invalide'},400)}
  if(!data||typeof data!=='object'||Array.isArray(data))return respond({ok:false,error:'Requête invalide'},400);
  if(!/^[0-9a-f-]{36}$/.test(String(data.id||'')))return respond({ok:false,error:'Identifiant invalide'},400);
  await env.DB.prepare('UPDATE forum_posts SET hidden=1 WHERE id=? OR parent_id=?').bind(data.id,data.id).run();
  return respond({ok:true});
 }
 return respond({ok:false,error:'Méthode inconnue'},405);
}
