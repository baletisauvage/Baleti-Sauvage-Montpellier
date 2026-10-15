var __defProp = Object.defineProperty;

var __name = (target, value) => __defProp(target, "name", { value, configurable: true });



var API_ORIGIN = "https://baleti-sauvage.baletisauvage.workers.dev";
var SITE = "https://baletisauvage.github.io";


async function v71B2Auth(env){const a=await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account',{headers:{Authorization:'Basic '+btoa(env.B2_KEY_ID+':'+env.B2_APPLICATION_KEY)}});if(!a.ok)throw Error('B2 authorization failed');const d=await a.json();const st=d.apiInfo?.storageApi;const api=st?.apiUrl||d.apiUrl;const allowed=st?.allowed?.bucketId||d.allowed?.bucketId;if(!api||!d.authorizationToken||(allowed&&allowed!==env.B2_BUCKET_ID))throw Error('B2 bucket mismatch');return {api,token:d.authorizationToken};}
async function v71GalleryPut(env,kind,file,bytes,mime){if(!['photos','videos','papiers'].includes(kind)||!/^[A-Za-z0-9_.-]{1,180}$/.test(file))throw Error('Nom de fichier invalide');const key='media:'+kind+':'+file;const exists=await env.DB.prepare('SELECT logical_key FROM b2_file_index WHERE logical_key=?').bind(key).first();if(exists)throw Error('Fichier déjà présent');const data=new Uint8Array(bytes);if(!data.length||data.length>8*1024*1024)throw Error('Taille invalide');const a=await v71B2Auth(env);const r=await fetch(a.api+'/b2api/v3/b2_get_upload_url',{method:'POST',headers:{Authorization:a.token,'Content-Type':'application/json'},body:JSON.stringify({bucketId:env.B2_BUCKET_ID})});if(!r.ok)throw Error('URL B2 indisponible');const u=await r.json();const hash=await crypto.subtle.digest('SHA-1',data);const sha=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');const name='media/'+kind+'/'+file;const put=await fetch(u.uploadUrl,{method:'POST',headers:{Authorization:u.authorizationToken,'X-Bz-File-Name':encodeURIComponent(name),'Content-Type':mime,'X-Bz-Content-Sha1':sha},body:data});if(!put.ok)throw Error('Échec envoi B2');const f=await put.json();if(!f.fileId||f.fileName!==name)throw Error('Réponse B2 invalide');await env.DB.prepare('INSERT INTO b2_file_index(logical_key,b2_file_id,b2_file_name,mime_type) VALUES(?,?,?,?)').bind(key,f.fileId,name,mime).run();return key;}
async function v71GalleryDelete(env,kind,file){const key='media:'+kind+':'+file;const row=await env.DB.prepare('SELECT b2_file_id,b2_file_name FROM b2_file_index WHERE logical_key=?').bind(key).first();if(!row)return;if(row.b2_file_name!=='media/'+kind+'/'+file)throw Error('Chemin B2 invalide');const a=await v71B2Auth(env);const d=await fetch(a.api+'/b2api/v3/b2_delete_file_version',{method:'POST',headers:{Authorization:a.token,'Content-Type':'application/json'},body:JSON.stringify({fileName:row.b2_file_name,fileId:row.b2_file_id})});if(!d.ok)throw Error('Suppression B2 échouée');await env.DB.prepare('DELETE FROM b2_file_index WHERE logical_key=?').bind(key).run();}
async function v71MediaCopy(env,kind,file){if(!['photos','videos','papiers'].includes(kind)||!/^[a-zA-Z0-9_.-]{1,180}$/.test(file))throw Error('Invalid gallery file');const logical='media:'+kind+':'+file;const existing=await env.DB.prepare('SELECT b2_file_id FROM b2_file_index WHERE logical_key=?').bind(logical).first();if(existing)return {status:'déjà sur B2'};const source='https://raw.githubusercontent.com/'+GH_OWNER+'/'+GH_REPO+'/'+GH_BRANCH+'/'+kind+'/'+encodeURIComponent(file);const response=await fetch(source);if(!response.ok)throw Error('GitHub source HTTP '+response.status);const contentLength=Number(response.headers.get('content-length')||0);if(contentLength>30*1024*1024)throw Error('Fichier trop volumineux');const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length||bytes.length>30*1024*1024)throw Error('Taille de fichier invalide');const auth=await v71B2Auth(env);const upload=await fetch(auth.api+'/b2api/v3/b2_get_upload_url',{method:'POST',headers:{Authorization:auth.token,'Content-Type':'application/json'},body:JSON.stringify({bucketId:env.B2_BUCKET_ID})});if(!upload.ok)throw Error('B2 upload URL HTTP '+upload.status);const u=await upload.json();const hash=await crypto.subtle.digest('SHA-1',bytes);const sha=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');const name='media/'+kind+'/'+file;const mime=kind==='photos'?'image/jpeg':kind==='videos'?'video/mp4':'application/pdf';const uploaded=await fetch(u.uploadUrl,{method:'POST',headers:{Authorization:u.authorizationToken,'X-Bz-File-Name':encodeURIComponent(name),'Content-Type':mime,'X-Bz-Content-Sha1':sha},body:bytes});if(!uploaded.ok)throw Error('B2 upload HTTP '+uploaded.status);const f=await uploaded.json();if(!f.fileId||f.fileName!==name)throw Error('B2 upload response invalid');const downloaded=await fetch(auth.api+'/b2api/v2/b2_download_file_by_id?fileId='+encodeURIComponent(f.fileId),{headers:{Authorization:auth.token}});if(!downloaded.ok)throw Error('B2 readback HTTP '+downloaded.status);const copy=new Uint8Array(await downloaded.arrayBuffer());if(copy.length!==bytes.length)throw Error('B2 readback size mismatch');const h=await crypto.subtle.digest('SHA-1',copy);const verify=[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');if(verify!==sha)throw Error('B2 readback checksum mismatch');await env.DB.prepare('INSERT INTO b2_file_index(logical_key,b2_file_id,b2_file_name,mime_type) VALUES(?,?,?,?)').bind(logical,f.fileId,name,mime).run();return {status:'copié et vérifié sur B2',bytes:bytes.length};}
async function v71B2Put(env,key,bytes){if(!/^(published\/)?[a-f0-9-]{36}$/.test(key))throw Error('Invalid attachment key');const a=await v71B2Auth(env);const u=await fetch(a.api+'/b2api/v3/b2_get_upload_url',{method:'POST',headers:{Authorization:a.token,'Content-Type':'application/json'},body:JSON.stringify({bucketId:env.B2_BUCKET_ID})});if(!u.ok)throw Error('B2 upload URL refused');const v=await u.json();const data=new Uint8Array(bytes);const digest=await crypto.subtle.digest('SHA-1',data);const sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');const name=key.startsWith('published/')?key:'messages/'+key;const put=await fetch(v.uploadUrl,{method:'POST',headers:{Authorization:v.authorizationToken,'X-Bz-File-Name':encodeURIComponent(name),'Content-Type':'application/octet-stream','X-Bz-Content-Sha1':sha},body:data});if(!put.ok)throw Error('B2 upload failed');const f=await put.json();if(!f.fileId||f.fileName!==name)throw Error('B2 upload response invalid');try{await env.DB.prepare('INSERT INTO b2_file_index(logical_key,b2_file_id,b2_file_name,mime_type) VALUES(?,?,?,?)').bind(key,f.fileId,name,'application/octet-stream').run()}catch(e){throw Error('B2 index failed; file retained for safe recovery')}return true;}
async function v71B2Get(env,key){const row=await env.DB.prepare('SELECT b2_file_id,b2_file_name FROM b2_file_index WHERE logical_key=?').bind(key).first();if(!row)return null;if(!String(row.b2_file_name).startsWith(key.startsWith('published/')?'published/':'messages/'))throw Error('B2 prefix mismatch');const a=await v71B2Auth(env);const d=await fetch(a.api+'/b2api/v2/b2_download_file_by_id?fileId='+encodeURIComponent(row.b2_file_id),{headers:{Authorization:a.token}});if(!d.ok)throw Error('B2 download failed');return new Uint8Array(await d.arrayBuffer());}
async function v71B2Delete(env,key){const row=await env.DB.prepare('SELECT b2_file_id,b2_file_name FROM b2_file_index WHERE logical_key=?').bind(key).first();if(!row)return false;if(!String(row.b2_file_name).startsWith(key.startsWith('published/')?'published/':'messages/'))throw Error('B2 prefix mismatch');const a=await v71B2Auth(env);const d=await fetch(a.api+'/b2api/v3/b2_delete_file_version',{method:'POST',headers:{Authorization:a.token,'Content-Type':'application/json'},body:JSON.stringify({fileId:row.b2_file_id,fileName:row.b2_file_name})});if(!d.ok)throw Error('B2 delete failed');await env.DB.prepare('DELETE FROM b2_file_index WHERE logical_key=?').bind(key).run();return true;}
async function attachmentPut(env,key,bytes){return v71B2Put(env,key,bytes);}
async function attachmentGet(env,key){return v71B2Get(env,key);}
async function attachmentDelete(env,key){return v71B2Delete(env,key);}

var COOKIE = "baleti_admin";

var SESSION = 43200;

var MAX_FAIL = 5;

var WINDOW = 900;

var GH_OWNER = "baletisauvage";

var GH_REPO = "Baleti-Sauvage-Montpellier";

var GH_BRANCH = "main";

var PHOTO_MANIFEST = "photos/photos.json";

var VIDEO_MANIFEST = "videos/videos.json";

var PAPER_MANIFEST = "papiers/papiers.json";

var DEFAULTS = { mode: "thu", usualPlace: "Place des Martyrs de la R\xE9sistance", usualLat: 43.6108225, usualLng: 3.8766489, baletiText: "Le texte de pr\xE9sentation du Bal\xE8ti Sauvage sera affich\xE9 ici.", links: [] };

var headers = /* @__PURE__ */ __name((x = {}) => ({ "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token", "Access-Control-Allow-Credentials": "true", ...x }), "headers");

var json = /* @__PURE__ */ __name((d, s = 200, x = {}) => new Response(JSON.stringify(d), { status: s, headers: headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...x }) }), "json");

function safe(a, b) {

  a = String(a || "");

  b = String(b || "");

  if (a.length !== b.length) return false;

  let r = 0;

  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return r === 0;

}

__name(safe, "safe");

async function hash(s) {

  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));

  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");

}

__name(hash, "hash");

async function signature(p) {

  return hash("Baleti Sauvage administration|" + p);

}

__name(signature, "signature");

async function auth(req, env) {
  const m = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)baleti_admin=([^;]+)/);
  if (!m || !env.DB) return false;
  const token = m[1];
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const tokenHash = await hash(token);
  const row = await env.DB.prepare("SELECT expires_at FROM admin_sessions WHERE token_hash=?").bind(tokenHash).first();
  return !!row && Number(row.expires_at) > Math.floor(Date.now()/1000);
}

__name(auth, "auth");

async function ensureColumns(DB, t, defs) {

  const i = await DB.prepare(`PRAGMA table_info('${t}')`).all(), n = new Set((i.results || []).map((c) => String(c.name)));

  for (const [k, d] of Object.entries(defs)) if (!n.has(k)) await DB.prepare(`ALTER TABLE ${t} ADD COLUMN ${k} ${d}`).run();

}

__name(ensureColumns, "ensureColumns");

async function init(DB) {

  await DB.batch([DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"), DB.prepare("CREATE TABLE IF NOT EXISTS event_overrides (event_date TEXT PRIMARY KEY,time TEXT,place TEXT,lat REAL,lng REAL,comment TEXT DEFAULT '',cancelled INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"), DB.prepare("CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,lat REAL,lng REAL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)"), DB.prepare("CREATE TABLE IF NOT EXISTS admin_login_rate (key TEXT PRIMARY KEY,failures INTEGER NOT NULL DEFAULT 0,first_failure INTEGER NOT NULL,last_failure INTEGER NOT NULL)"), DB.prepare("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT,prenom TEXT NOT NULL,contact TEXT DEFAULT '',message TEXT NOT NULL,date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,lu INTEGER NOT NULL DEFAULT 0)"), DB.prepare("CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, prenom TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', telephone TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"), DB.prepare("CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)"), DB.prepare("CREATE TABLE IF NOT EXISTS public_request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)"), DB.prepare("CREATE TABLE IF NOT EXISTS unsubscribe_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)"), DB.prepare("CREATE TABLE IF NOT EXISTS contact_optin_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, prenom TEXT NOT NULL, telephone TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)")]);

  await DB.prepare("CREATE TABLE IF NOT EXISTS published_attachments (id TEXT PRIMARY KEY, source_message_id INTEGER, original_name TEXT NOT NULL, media_type TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_published_message ON published_attachments(source_message_id)").run();
  await DB.prepare("CREATE TABLE IF NOT EXISTS github_cleanup_queue (path TEXT PRIMARY KEY, sha TEXT NOT NULL, kind TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();

  await ensureColumns(DB, "event_overrides", { time: "TEXT", place: "TEXT", lat: "REAL", lng: "REAL", comment: "TEXT DEFAULT ''", cancelled: "INTEGER NOT NULL DEFAULT 0", updated_at: "TEXT" });

  await ensureColumns(DB, "locations", { name: "TEXT", lat: "REAL", lng: "REAL", created_at: "TEXT" });

  await ensureColumns(DB, "messages", { prenom: "TEXT", contact: "TEXT DEFAULT ''", message: "TEXT", date_creation: "TEXT", lu: "INTEGER NOT NULL DEFAULT 0", attachment_file_id: "TEXT", attachment_name: "TEXT", attachment_type: "TEXT", attachment_size: "INTEGER" });

}

__name(init, "init");

async function settings(DB) {

  const r = await DB.prepare("SELECT key,value FROM settings").all(), s = { ...DEFAULTS };

  for (const x of r.results || []) {

    try {

      s[x.key] = JSON.parse(x.value);

    } catch {

      s[x.key] = x.value;

    }

  }

  return s;

}

__name(settings, "settings");

async function save(DB, k, v) {

  await DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(k, JSON.stringify(v)).run();

}

__name(save, "save");

async function overrides(DB) {

  return (await DB.prepare("SELECT event_date,time,place,lat,lng,comment,cancelled FROM event_overrides ORDER BY event_date").all()).results || [];

}

__name(overrides, "overrides");

async function locations(DB) {

  return (await DB.prepare("SELECT id,name,lat,lng FROM locations WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY id DESC").all()).results || [];

}

__name(locations, "locations");

async function messages(DB) {

  return (await DB.prepare("SELECT m.id,m.prenom,m.contact,m.message,m.date_creation,m.lu,m.attachment_file_id,m.attachment_name,m.attachment_type,m.attachment_size,(SELECT COUNT(*) FROM published_attachments p WHERE p.source_message_id=m.id) AS published_count FROM messages m ORDER BY m.id DESC LIMIT 200").all()).results || [];

}

__name(messages, "messages");

async function rateKey(req, env) {

  return hash(`baleti-login|${req.headers.get("CF-Connecting-IP") || "unknown"}|${env.ADMIN_PASSWORD || ""}`);

}

__name(rateKey, "rateKey");

async function blocked(env, k) {

  const n = Math.floor(Date.now() / 1e3), r = await env.DB.prepare("SELECT failures,first_failure FROM admin_login_rate WHERE key=?").bind(k).first();

  if (!r) return false;

  if (n - Number(r.first_failure) >= WINDOW) {

    await env.DB.prepare("DELETE FROM admin_login_rate WHERE key=?").bind(k).run();

    return false;

  }

  return Number(r.failures) >= MAX_FAIL;

}

__name(blocked, "blocked");

async function fail(env, k) {

  const n = Math.floor(Date.now() / 1e3), r = await env.DB.prepare("SELECT failures,first_failure FROM admin_login_rate WHERE key=?").bind(k).first();

  if (!r || n - Number(r.first_failure) >= WINDOW) await env.DB.prepare("INSERT OR REPLACE INTO admin_login_rate(key,failures,first_failure,last_failure) VALUES(?,1,?,?)").bind(k, n, n).run();

  else await env.DB.prepare("UPDATE admin_login_rate SET failures=failures+1,last_failure=? WHERE key=?").bind(n, k).run();

}

__name(fail, "fail");

function validHttpUrl(value) {
  try { const u = new URL(value); return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname && !u.username && !u.password; } catch { return false; }
}

function cleanLinks(v) {

  return Array.isArray(v) ? v.slice(0, 50).map((x) => ({ title: String(x?.title || "").trim().slice(0, 120), url: String(x?.url || "").trim().slice(0, 1e3) })).filter((x) => x.title && /^https?:\/\//i.test(x.url)) : [];

}

__name(cleanLinks, "cleanLinks");

function b64(a) {

  let s = "";

  for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));

  return btoa(s);

}

__name(b64, "b64");

function from64(s) {

  const b = atob(String(s || "").replace(/\n/g, "")), a = new Uint8Array(b.length);

  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);

  return new TextDecoder().decode(a);

}

__name(from64, "from64");

async function gh(env, path, method = "GET", body = null, allow404 = false) {

  if (!env.GITHUB_TOKEN) throw Error("Le secret GITHUB_TOKEN est absent.");

  const sp = String(path).split("/").map(encodeURIComponent).join("/"), u = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${sp}`, o = { method, headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Baleti-Sauvage-Worker" } };

  if (body) {

    o.headers["Content-Type"] = "application/json";

    o.body = JSON.stringify(body);

  }

  const r = await fetch(u, o);

  if (allow404 && r.status === 404) return null;

  if (!r.ok) { const err = Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 250)}`); if (r.status === 409 || r.status === 412) err.status = 409; throw err; }

  return r.json();

}

__name(gh, "gh");

async function arrayData(env, path) {

  const local=await env.DB.prepare('SELECT content,revision FROM staging_gallery_manifests WHERE path=?').bind(path).first();if(local){const items=JSON.parse(local.content);if(!Array.isArray(items))throw Error('Manifeste V7.1 invalide');return {file:{sha:String(local.revision)},items};}
  const f = await gh(env, path, "GET", null, true);

  if (!f) return { file: null, items: [] };

  // Fail closed: a corrupt manifest must never be overwritten as an empty gallery.
  let items;
  try { items = JSON.parse(from64(f.content)); }
  catch { throw Error(`Manifeste GitHub illisible : ${path}`); }
  if (!Array.isArray(items)) throw Error(`Manifeste GitHub invalide : ${path}`);
  return { file: f, items };

}

__name(arrayData, "arrayData");

async function saveArray(env,path,items,sha,message){
  if(![PHOTO_MANIFEST,VIDEO_MANIFEST,PAPER_MANIFEST].includes(path))throw Error('Manifeste V7.1 non autorisé');
  if(!Array.isArray(items))throw Error('Liste de galerie invalide');
  const content=JSON.stringify(items);
  const local=await env.DB.prepare('SELECT revision FROM staging_gallery_manifests WHERE path=?').bind(path).first();
  if(!local){
    const initial=await gh(env,path,'GET',null,true);
    if(initial&&!Array.isArray(JSON.parse(from64(initial.content))))throw Error('Manifeste GitHub invalide');if(String(initial?.sha||'')!==String(sha||'')){const e=Error('Conflit de galerie');e.status=409;throw e;}
    const result=await env.DB.prepare('INSERT OR IGNORE INTO staging_gallery_manifests(path,content,revision) VALUES(?,?,1)').bind(path,content).run();
    if(result.meta?.changes!==1){const e=Error('Conflit V7.1, recharge la galerie');e.status=409;throw e;}
    return {ok:true};
  }
  if(String(local.revision)!==String(sha)){const e=Error('Conflit V7.1, recharge la galerie');e.status=409;throw e;}
  const result=await env.DB.prepare('UPDATE staging_gallery_manifests SET content=?,revision=revision+1 WHERE path=? AND revision=?').bind(content,path,local.revision).run();
  if(result.meta?.changes!==1){const e=Error('Conflit V7.1, recharge la galerie');e.status=409;throw e;}
  return {ok:true};
}
__name(saveArray, "saveArray");

function cleanPhoto(x) {

  return { fichier: String(x?.fichier || ""), titre: String(x?.titre || "").slice(0, 100), datePhoto: String(x?.datePhoto || "").slice(0, 10), credit: String(x?.credit || "").slice(0, 120), lien: /^https?:\/\//i.test(String(x?.lien || "")) ? String(x.lien).slice(0, 500) : "", texteLien: String(x?.texteLien || "").slice(0, 80), visible: x?.visible !== false, principale: !!x?.principale, ajouteLe: String(x?.ajouteLe || "") };

}

__name(cleanPhoto, "cleanPhoto");

function photoPublic(p) {

  return { ...cleanPhoto(p), url: `${API_ORIGIN}/api/media/file?kind=photos&file=${encodeURIComponent(p.fichier)}` };

}

__name(photoPublic, "photoPublic");

async function photoData(env) {

  const d = await arrayData(env, PHOTO_MANIFEST);

  return { file: d.file, photos: d.items.map(cleanPhoto) };

}

__name(photoData, "photoData");

async function savePhotos(env, p, sha, m) {

  return saveArray(env, PHOTO_MANIFEST, p.map(cleanPhoto), sha, m);

}

__name(savePhotos, "savePhotos");

function youtubeId(url) {

  const s = String(url || "").trim();

  try {

    const u = new URL(s);

    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0];

    if (/(^|\.)youtube\.com$/i.test(u.hostname)) {

      if (u.pathname === "/watch") return u.searchParams.get("v") || "";

      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);

      if (m) return m[1];

    }

  } catch {

  }

  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : "";

}

__name(youtubeId, "youtubeId");

function cleanVideo(v) {

  const id = String(v?.youtubeId || "");

  return { youtubeId: /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "", titre: String(v?.titre || "").trim().slice(0, 120), url: `https://www.youtube.com/watch?v=${id}`, dateVideo: String(v?.dateVideo || "").slice(0, 10), evenement: String(v?.evenement || "").trim().slice(0, 120), visible: v?.visible !== false, principale: !!v?.principale, ajouteLe: String(v?.ajouteLe || "") };

}

__name(cleanVideo, "cleanVideo");

async function videoData(env) {

  const d = await arrayData(env, VIDEO_MANIFEST);

  return { file: d.file, videos: d.items.map((v)=>v?.direct&&v?.fichier?{...v,visible:v.visible!==false}:cleanVideo(v)).filter((v)=>v.youtubeId||(v.direct&&v.fichier)) };

}

__name(videoData, "videoData");

async function saveVideos(env, v, sha, m) {

  return saveArray(env, VIDEO_MANIFEST, v.map(x=>x?.direct&&x?.fichier?{...x,visible:x.visible!==false}:cleanVideo(x)), sha, m);

}

__name(saveVideos, "saveVideos");

function cleanPaper(x) {

  return { fichier: String(x?.fichier || ""), nomOriginal: String(x?.nomOriginal || ""), titre: String(x?.titre || "").trim().slice(0, 120), visible: x?.visible !== false, taille: Number(x?.taille || 0), ajouteLe: String(x?.ajouteLe || "") };

}

__name(cleanPaper, "cleanPaper");

function paperPublic(p) {

  return { ...cleanPaper(p), url: `${API_ORIGIN}/api/media/file?kind=papiers&file=${encodeURIComponent(p.fichier)}` };

}

__name(paperPublic, "paperPublic");

async function paperData(env) {

  const d = await arrayData(env, PAPER_MANIFEST);

  return { file: d.file, papers: d.items.map(cleanPaper) };

}

__name(paperData, "paperData");

async function savePapers(env, p, sha, m) {

  return saveArray(env, PAPER_MANIFEST, p.map(cleanPaper), sha, m);

}

__name(savePapers, "savePapers");

// Compensating action: GitHub Contents API cannot atomically commit media and manifest.
// If the manifest write fails, remove only the newly uploaded file (using its exact SHA).
// Failure of the compensation is reported, never silently treated as success.
async function uploadAndIndex(env,path,bytes,manifestWrite,message){
 const [kind,file]=path.split('/');
 await v71GalleryPut(env,kind,file,bytes,kind==='photos'?'image/jpeg':'application/pdf');
 try{await manifestWrite();}catch(e){try{await v71GalleryDelete(env,kind,file);}catch(_){}throw e;}
}
__name(uploadAndIndex, "uploadAndIndex");

// Durable cleanup queue: never delete a file that is still referenced by a manifest.
async function cleanupGithubQueue(env, max = 20) {
  const rows = (await env.DB.prepare("SELECT path,sha,kind FROM github_cleanup_queue ORDER BY created_at LIMIT ?").bind(max).all()).results || [];
  const results = [];
  for (const row of rows) {
    try {
      const manifest = row.kind === "photo" ? await photoData(env) : await paperData(env);
      const filename = row.path.split("/").pop();
      const entries = row.kind === "photo" ? manifest.photos : manifest.papers;
      if (entries.some(x => x.fichier === filename)) {
        results.push({path:row.path,status:"referenced"});
        continue;
      }
      const current = await gh(env,row.path,"GET",null,true);
      if (!current || current.sha !== row.sha) {
        // A different version must never be removed using a stale queue entry.
        await env.DB.prepare("DELETE FROM github_cleanup_queue WHERE path=? AND sha=?").bind(row.path,row.sha).run();
        results.push({path:row.path,status:current ? "changed" : "already_deleted"});
        continue;
      }
      await gh(env,row.path,"DELETE",{message:`Nettoyage fichier non référencé : ${row.path}`,sha:row.sha,branch:GH_BRANCH});
      await env.DB.prepare("DELETE FROM github_cleanup_queue WHERE path=? AND sha=?").bind(row.path,row.sha).run();
      results.push({path:row.path,status:"deleted"});
    } catch(e) {
      await env.DB.prepare("UPDATE github_cleanup_queue SET attempts=attempts+1,last_error=? WHERE path=? AND sha=?").bind(String(e.message||e).slice(0,250),row.path,row.sha).run();
      results.push({path:row.path,status:"failed"});
    }
  }
  return results;
}
__name(cleanupGithubQueue,"cleanupGithubQueue");

// Phase 34: bound authenticated multipart uploads before formData() allocates memory.
async function boundedAdminForm(req) {
  const max = 10 * 1024 * 1024; // 8 MiB file + multipart envelope
  const declared = Number(req.headers.get("Content-Length") || 0);
  if (declared > max) { const e = Error("Upload trop volumineux"); e.status = 413; throw e; }
  const ct = req.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) { const e = Error("Formulaire multipart requis"); e.status = 415; throw e; }
  const reader = req.body?.getReader();
  if (!reader) { const e = Error("Corps manquant"); e.status = 400; throw e; }
  let total = 0, overflow = false;
  const chunks = [];
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) { overflow = true; break; }
      chunks.push(value);
    }
  } finally {
    if (overflow) { try { await reader.cancel(); } catch (_) {} }
    reader.releaseLock();
  }
  if (overflow) { const e = Error("Upload trop volumineux"); e.status = 413; throw e; }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(bytes, {headers:{"Content-Type":ct}}).formData();
}
__name(boundedAdminForm, "boundedAdminForm");

async function uploadPhoto(req, env) {

  const f = await boundedAdminForm(req), file = f.get("photo");

  if (!file?.size) throw Error("Choisis une photo.");

  if (file.type !== "image/jpeg") throw Error("Format accepté : JPG uniquement.");

  if (file.size > 8 * 1024 * 1024) throw Error("Maximum : 8 Mo.");

  const photoBytes = await file.arrayBuffer();
  if (!validFileSignature(file, photoBytes) || new Uint8Array(photoBytes).at(-2) !== 0xff || new Uint8Array(photoBytes).at(-1) !== 0xd9)
    throw Error("Photo JPEG invalide.");
  const d = await photoData(env); // refuse a corrupt manifest before any public upload
  const datePhoto = String(f.get("datePhoto") || "").slice(0, 10), name = `baleti-${(/* @__PURE__ */ new Date()).toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}.jpg`;


  let ps = d.photos, main = String(f.get("principale") || "") === "1";

  if (main) ps = ps.map((p) => ({ ...p, principale: false }));

  ps.unshift({ fichier: name, titre: String(f.get("titre") || "").trim(), datePhoto, credit: String(f.get("credit") || "").trim(), lien: String(f.get("lien") || "").trim(), texteLien: String(f.get("texteLien") || "").trim(), visible: String(f.get("visible") || "") === "1" || main, principale: main, ajouteLe: (/* @__PURE__ */ new Date()).toISOString() });

  await uploadAndIndex(env, `photos/${name}`, photoBytes, () => savePhotos(env, ps, d.file?.sha, "Mise \xE0 jour galerie Bal\xE8ti Sauvage"), `Ajout photo Bal\xE8ti Sauvage : ${name}`);

  return ps.map(photoPublic);

}

__name(uploadPhoto, "uploadPhoto");

async function uploadPaper(req, env) {

  const f = await boundedAdminForm(req), file = f.get("paper");

  if (!file?.size) throw Error("Choisis un document.");

  if (file.size > 8 * 1024 * 1024) throw Error("Maximum : 8 Mo.");

  const original = String(file.name || "document").slice(0, 180), ext = (original.match(/\.([A-Za-z0-9]{1,8})$/) || [])[1]?.toLowerCase() || "";

  // Only PDF has a checked signature; do not put unverified office formats on public Pages.
  if (ext !== "pdf" || file.type !== "application/pdf") throw Error("Publication directe limitée aux PDF vérifiés.");
  const paperBytes = await file.arrayBuffer();
  if (!validFileSignature(file, paperBytes)) throw Error("Signature PDF invalide.");
  const d = await paperData(env); // refuse a corrupt manifest before any public upload

  const name = `papier-${(/* @__PURE__ */ new Date()).toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;


  const ps = d.papers;

  ps.unshift({ fichier: name, nomOriginal: original, titre: String(f.get("titre") || original).trim(), visible: String(f.get("visible") || "") === "1", taille: file.size, ajouteLe: (/* @__PURE__ */ new Date()).toISOString() });

  await uploadAndIndex(env, `papiers/${name}`, paperBytes, () => savePapers(env, ps, d.file?.sha, "Mise \xE0 jour papiers Bal\xE8ti Sauvage"), `Ajout papier Bal\xE8ti Sauvage : ${name}`);

  return ps.map(paperPublic);

}

__name(uploadPaper, "uploadPaper");

// Phase 1: contacts, multipart messages and private R2 attachments.
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254; }
function normalizePhone(v) {
  let n = String(v || "").replace(/[\s.()-]/g, "");
  if (/^\+33[1-9]\d{8}$/.test(n)) n = "0" + n.slice(3);
  return /^0[1-9]\d{8}$/.test(n) ? n : "";
}
function coordsOK(lat, lng) {
  return lat !== null && lat !== undefined && lat !== "" && lng !== null && lng !== undefined && lng !== "" &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
async function contacts(DB) {
  return (await DB.prepare("SELECT id,prenom,email,telephone,active,created_at,updated_at FROM contacts ORDER BY id DESC LIMIT 2000").all()).results || [];
}
function contactPayload(b) {
  const prenom = String(b.prenom || "").trim().slice(0, 60);
  const email = String(b.email || "").trim().toLowerCase();
  const telephone = normalizePhone(b.telephone);
  if (!prenom || (!email && !telephone) || (email && !validEmail(email)) || (b.telephone && !telephone)) return null;
  return { prenom, email, telephone };
}
function attachmentAllowed(file) {
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  const types = {jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",pdf:"application/pdf",txt:"text/plain",mp4:"video/mp4",webm:"video/webm",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",odt:"application/vnd.oasis.opendocument.text",rtf:"application/rtf"};
  return !!types[ext] && (!file.type || file.type === types[ext] || file.type === "application/octet-stream");
}
// Phase 5: public submission throttling and binary signature checks.
async function publicRateLimited(request, env, category, max = 6) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await hash("public:" + category + ":" + ip);
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 3600;
  // Atomic UPSERT: concurrent requests cannot all pass based on a stale SELECT.
  await env.DB.prepare(`INSERT INTO public_request_limits(key,count,window_start) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN window_start < ? THEN 1 ELSE count+1 END,
      window_start=CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END`)
    .bind(key,now,cutoff,cutoff).run();
  const row = await env.DB.prepare("SELECT count FROM public_request_limits WHERE key=?").bind(key).first();
  return Number(row?.count || 0) > max;
}
function validFileSignature(file, bytes) {
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  const b = new Uint8Array(bytes);
  const begins = (...v) => v.every((x,i) => b[i] === x);
  if (ext === "jpg" || ext === "jpeg") return begins(0xff,0xd8,0xff);
  if (ext === "png") return begins(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if (ext === "pdf") return begins(0x25,0x50,0x44,0x46,0x2d);
  if (ext === "webm") return begins(0x1a,0x45,0xdf,0xa3);
  if (ext === "mp4") return b.length >= 12 && begins(0x00,0x00,0x00) &&
    String.fromCharCode(...b.slice(4,8)) === "ftyp";
  // Other document types require more complete container validation; do not
  // claim that checking the extension/MIME alone verifies their contents.
  return true;
}
var worker_default = { async fetch(request, env) {

  if (request.method === "OPTIONS") {
    if (request.headers.get("Origin") !== SITE) return new Response(null, { status: 403 });
    return new Response(null, { headers: headers() });
  }
  // Public/admin API writes originate on GitHub Pages. The unsubscribe
  // confirmation form is hosted by this Worker and submits to its own origin.
  // Do not extend this exception to any other POST endpoint.
  if (request.method === "POST") {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    const isConfirmation = url.pathname === "/api/contacts/unsubscribe/confirm" || url.pathname === "/api/contacts/confirm";
    if (origin !== SITE && !(isConfirmation && origin === url.origin) && !((url.pathname === "/api/login" || url.pathname === "/api/messages" || url.pathname === "/api/admin/migrate-attachments-v71" || url.pathname === "/api/admin/migrate-gallery-v71" || url.pathname === "/api/admin/gallery-v71/upload" || url.pathname === "/api/admin/gallery-v71/delete") && url.hostname === "baleti-sauvage.baletisauvage.workers.dev" && origin === url.origin))
      return json({ok:false,error:"Origine non autorisée"},403);
  }

  try {

    if (!env.DB) return json({ ok: false, error: "Base D1 non connect\xE9e" }, 500);

    const p = new URL(request.url).pathname;

    if(p==='/admin-galerie'&&request.method==='GET')return Response.redirect(new URL('/admin-galerie-b2-v71',request.url).toString(),302);
    if (p === "/admin-v71" && request.method === "GET") return new Response("<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Balèti V7.1 - Connexion</title><style>body{font:16px system-ui;max-width:480px;margin:8vh auto;padding:20px}input,button{display:block;box-sizing:border-box;width:100%;padding:12px;margin:12px 0;font:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:12px}</style><h1>Administration V7.1</h1><p>Connexion à l’administration Balèti Sauvage.</p><form id=\"f\"><label>Mot de passe administrateur<input id=\"pw\" type=\"password\" autocomplete=\"current-password\" required></label><button>Se connecter</button></form><button id=\"b\" type=\"button\">Vérifier Backblaze B2</button><p><a href=\"/admin-galerie-b2-v71\">Gérer les photos, vidéos et PDF sur B2 (V7.1)</a></p><pre id=\"out\" aria-live=\"polite\">Prêt.</pre><script>const out=document.getElementById('out');document.getElementById('f').onsubmit=async e=>{e.preventDefault();const pw=document.getElementById('pw');try{const r=await fetch('/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw.value})});pw.value='';out.textContent=JSON.stringify(await r.json(),null,2)}catch(e){out.textContent='Connexion impossible'}};document.getElementById('b').onclick=async()=>{try{const r=await fetch('/api/admin/b2-check',{credentials:'same-origin'});out.textContent=JSON.stringify(await r.json(),null,2)}catch(e){out.textContent='Diagnostic inaccessible'}};</script></html>",{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
    if(p==='/admin-galerie-b2-v71'&&request.method==='GET')return new Response("<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Galerie B2 V7.1</title><style>body{font:16px system-ui;max-width:800px;margin:auto;padding:24px;line-height:1.5}button,input,select{font:inherit;padding:9px;margin:5px}li{margin:10px 0}</style><h1>Administration de la galerie V7.1</h1><p><button id=\"health\" type=\"button\">Vérifier les fichiers B2</button> <button id=\"deephealth\" type=\"button\">Tester la lecture réelle B2</button></p><p>Connecte-toi d'abord à <a href=\"/admin-v71\">l'administration V7.1</a>. Les fichiers du site officiel sont conservés.</p><form id=\"f\"><select name=\"kind\"><option value=\"photos\">Photo JPG</option><option value=\"videos\">Vidéo MP4</option><option value=\"papiers\">PDF</option></select><input name=\"title\" placeholder=\"Titre\"><input type=\"file\" name=\"file\" accept=\"image/jpeg,video/mp4,application/pdf\" required><small>8 Mo maximum par fichier.</small><button>Ajouter sur B2</button></form><p id=\"state\">Prêt</p><ul id=\"list\"></ul><script>var state=document.getElementById('state'),list=document.getElementById('list');document.getElementById('deephealth').onclick=async()=>{state.textContent='Lecture B2 en cours…';try{var r=await fetch('/api/admin/gallery-v71/health/deep'),d=await r.json();state.textContent=JSON.stringify(d,null,2)}catch(e){state.textContent=String(e)}};document.getElementById('health').onclick=async()=>{try{var r=await fetch('/api/admin/gallery-v71/health'),d=await r.json();state.textContent=JSON.stringify(d,null,2)}catch(e){state.textContent=String(e)}};async function load(){try{var r=await fetch('/api/media'),d=await r.json();list.replaceChildren();for(var x of d.files){var li=document.createElement('li'),a=document.createElement('a');a.textContent=x.kind+' / '+x.file;a.href='/api/media/file?kind='+encodeURIComponent(x.kind)+'&file='+encodeURIComponent(x.file);a.target='_blank';li.appendChild(a);if(x.file.startsWith('v71-')){var b=document.createElement('button');b.textContent='Supprimer';b.onclick=async function(k,f){if(!confirm('Supprimer ce fichier V7.1 ?'))return;var res=await fetch('/api/admin/gallery-v71/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:k,file:f})});state.textContent=JSON.stringify(await res.json());load()}.bind(null,x.kind,x.file);li.appendChild(b)}list.appendChild(li)}}catch(e){state.textContent=String(e)}}document.getElementById('f').onsubmit=async function(e){e.preventDefault();state.textContent='Envoi en cours…';try{var r=await fetch('/api/admin/gallery-v71/upload',{method:'POST',body:new FormData(e.target)}),d=await r.json();state.textContent=JSON.stringify(d);if(d.ok){e.target.reset();load()}}catch(e){state.textContent=String(e)}};load();</script></html>",{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
    if(p==="/galerie-b2"&&request.method==="GET")return new Response("<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Galerie B2 V7.1</title><style>body{font:16px system-ui;max-width:1000px;margin:auto;padding:22px;line-height:1.5}img{width:100%;height:180px;object-fit:cover;border-radius:8px}#photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px}figure{margin:0}video{max-width:100%;width:580px}a{overflow-wrap:anywhere}</style><h1>Galerie — Backblaze B2</h1><p>Photos, vidéos et documents de Balèti Sauvage.</p><p id=\"state\">Chargement…</p><h2>Photos</h2><div id=\"photos\"></div><h2>Vidéo</h2><div id=\"video\"></div><h2>PDF</h2><div id=\"pdf\"></div><script>(async function(){var state=document.getElementById('state');try{var r=await fetch('/api/media');var d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Erreur de chargement');var ps=document.getElementById('photos'),vs=document.getElementById('video'),pdf=document.getElementById('pdf');for(var x of d.files){var url='/api/media/file?kind='+encodeURIComponent(x.kind)+'&file='+encodeURIComponent(x.file);if(x.kind==='photos'){var f=document.createElement('figure'),a=document.createElement('a'),im=document.createElement('img');a.href=url;a.target='_blank';im.src=url;im.alt=x.file;im.loading='lazy';a.appendChild(im);f.appendChild(a);ps.appendChild(f)}else if(x.kind==='videos'){var v=document.createElement('video');v.controls=true;v.preload='metadata';v.src=url;vs.appendChild(v)}else{var a=document.createElement('a');a.href=url;a.target='_blank';a.textContent='Ouvrir le PDF : '+x.file;pdf.appendChild(a)}}state.textContent=d.files.length+' fichiers disponibles sur B2.'}catch(e){state.textContent='Erreur : '+e.message}})();</script></html>",{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
    if(p==="/api/media"&&request.method==="GET"){const files=[];for(const [kind,path] of [['photos',PHOTO_MANIFEST],['videos',VIDEO_MANIFEST],['papiers',PAPER_MANIFEST]]){const d=await arrayData(env,path);for(const item of d.items){if(!item||typeof item.fichier!=='string')continue;const indexed=await env.DB.prepare('SELECT b2_file_id FROM b2_file_index WHERE logical_key=?').bind('media:'+kind+':'+item.fichier).first();if(indexed)files.push({kind,file:item.fichier});}}return json({ok:true,files});}
    if(p==="/api/media/file"&&request.method==="GET"){const q=new URL(request.url).searchParams;const kind=q.get('kind'),file=q.get('file');if(!['photos','videos','papiers'].includes(kind)||!/^[a-zA-Z0-9_.-]{1,180}$/.test(file||''))return json({ok:false,error:'Fichier invalide'},400);const indexed=await env.DB.prepare('SELECT b2_file_id,b2_file_name,mime_type FROM b2_file_index WHERE logical_key=?').bind('media:'+kind+':'+file).first();if(!indexed||indexed.b2_file_name!=='media/'+kind+'/'+file)return json({ok:false,error:'Fichier absent de B2'},404);const manifestPath=kind==='photos'?PHOTO_MANIFEST:kind==='videos'?VIDEO_MANIFEST:PAPER_MANIFEST;const manifest=await arrayData(env,manifestPath);if(!manifest.items.some(x=>x&&x.fichier===file&&x.visible!==false))return json({ok:false,error:'Fichier non publié dans la galerie V7.1'},404);const auth=await v71B2Auth(env);const h={Authorization:auth.token};const range=request.headers.get('Range');if(range&&/^bytes=\d+-\d*$/.test(range))h.Range=range;const upstream=await fetch(auth.api+'/b2api/v2/b2_download_file_by_id?fileId='+encodeURIComponent(indexed.b2_file_id),{headers:h});if(!upstream.ok)return json({ok:false,error:'Lecture B2 HTTP '+upstream.status},502);const headers=new Headers({'Content-Type':indexed.mime_type||'application/octet-stream','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Disposition':'inline; filename="'+file+'"'});for(const k of ['Content-Length','Content-Range']){const v=upstream.headers.get(k);if(v)headers.set(k,v)}return new Response(upstream.body,{status:upstream.status===206?206:200,headers});}
    if (p === "/galerie-b2-v71" && request.method === "GET") return new Response("<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Migration galerie V7.1</title><style>body{font:16px system-ui;max-width:650px;margin:5vh auto;padding:20px;line-height:1.5}button{padding:15px;font:inherit;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:12px}</style><h1>Galerie vers Backblaze B2</h1><p>Connecte-toi d'abord à <a href=\"/admin-v71\">l'administration V7.1</a>. Les originaux restent intacts.</p><button id=\"go\" type=\"button\">Copier et vérifier la galerie</button><p id=\"status\" aria-live=\"polite\">Page prête. Clique sur le bouton.</p><pre id=\"out\"></pre><script>var b=document.getElementById('go');b.addEventListener('click',async function(){var o=document.getElementById('out'),s=document.getElementById('status');b.disabled=true;var start=0,logs=[];s.textContent='Traitement en cours';try{for(var n=0;n<100;n++){var r=await fetch('/api/admin/migrate-gallery-v71',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:start}),credentials:'same-origin'});var d=await r.json();if(!r.ok||!Array.isArray(d.results)){s.textContent='Erreur : '+r.status;o.textContent=JSON.stringify(d,null,2);break}logs=logs.concat(d.results);o.textContent=JSON.stringify({total:d.total,traites:logs.length,results:logs},null,2);s.textContent=logs.length+' sur '+d.total+' traités';if(!d.ok){s.textContent='Un fichier a échoué. Tu peux relancer après correction.';break}if(d.done){s.textContent='Terminé : '+logs.length+' fichiers traités.';break}start=d.next}}catch(e){s.textContent='Erreur de connexion';o.textContent=String(e)}finally{b.disabled=false}});</script></html>",{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
    if (p === "/") return json({ ok: true, site: "Bal\xE8ti Sauvage Montpellier", worker: "connect\xE9", database: true, adminConfigured: !!env.ADMIN_PASSWORD, githubConfigured: !!env.GITHUB_TOKEN });

    await init(env.DB);

    if (p === "/api/messages" && request.method === "POST") {
      if (await publicRateLimited(request, env, "messages", 100)) return json({ok:false,error:"Trop d’envois. Réessaie dans une heure."},429);
      const ct = request.headers.get("Content-Type") || "";
      if (Number(request.headers.get("Content-Length") || 0) > 12 * 1024 * 1024) return json({ok:false,error:"Envoi trop volumineux"},413);
      // Bound the actual streamed body even when Content-Length is missing or incorrect.
      const maxBodyBytes = 12 * 1024 * 1024;
      const reader = request.body?.getReader();
      if (!reader) return json({ok:false,error:"Corps de requête manquant"},400);
      const chunks = []; let totalBytes = 0; let tooLarge = false;
      try {
        while (true) {
          const {done,value} = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          if (totalBytes > maxBodyBytes) { tooLarge = true; break; }
          chunks.push(value);
        }
      } finally {
        if (tooLarge) { try { await reader.cancel(); } catch (_) {} }
        reader.releaseLock();
      }
      if (tooLarge) return json({ok:false,error:"Envoi trop volumineux"},413);
      const bodyBytes = new Uint8Array(totalBytes); let bodyOffset = 0;
      for (const chunk of chunks) { bodyBytes.set(chunk,bodyOffset); bodyOffset += chunk.byteLength; }
      const b = ct.includes("multipart/form-data")
        ? await new Response(bodyBytes,{headers:{"Content-Type":ct}}).formData()
        : JSON.parse(new TextDecoder().decode(bodyBytes));
      const get = k => b instanceof FormData ? b.get(k) : b[k];
      const prenom = String(get("prenom") || "").trim().slice(0,60);
      const contact = String(get("contact") || "").trim().slice(0,254);
      const message = String(get("message") || "").trim().slice(0,1200);
      if (String(get("website") || "").trim()) return json({ok:true});
      if (!prenom || !message) return json({ok:false,error:"Prénom et message obligatoires."},400);
      const file = get("attachment");
      let fileId = null, fileName = null, fileType = null, fileSize = null;
      if (file && typeof file === "object" && file.size > 0) {
        if (file.size > 8*1024*1024 || !attachmentAllowed(file)) return json({ok:false,error:"Type de pièce jointe refusé ou fichier supérieur à 8 Mo."},400);
        if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID) return json({ok:false,error:"Stockage B2 non configuré."},503);
        fileId = crypto.randomUUID(); fileName = String(file.name || "fichier").replace(/[\/\\\x00-\x1f]/g,"_").slice(0,180);
        fileType = file.type || "application/octet-stream"; fileSize = file.size;
        const fileBytes = await file.arrayBuffer();
        if (!validFileSignature(file, fileBytes)) return json({ok:false,error:"Le contenu du fichier ne correspond pas à son format."},400);
        await attachmentPut(env, fileId, fileBytes);
      }
      try {
        await env.DB.prepare("INSERT INTO messages(prenom,contact,message,lu,date_creation,attachment_file_id,attachment_name,attachment_type,attachment_size) VALUES(?,?,?,0,CURRENT_TIMESTAMP,?,?,?,?)").bind(prenom,contact,message,fileId,fileName,fileType,fileSize).run();
      } catch (e) { if (fileId) { try { await attachmentDelete(env, fileId); } catch (cleanupError) { console.error("R2 cleanup after D1 failure failed", cleanupError); } } throw e; }
      return json({ok:true});
    }
    // Phase 15: only verified email addresses may create/reactivate subscriptions.
    if (p === "/api/contacts" && request.method === "POST") {
      if (await publicRateLimited(request, env, "contacts")) return json({ok:false,error:"Trop de demandes. Réessaie dans une heure."},429);
      const b = await request.json(), c = contactPayload(b);
      if (!c || b.consent !== true || !c.email) return json({ok:false,error:"Prénom, adresse email valide et consentement explicite obligatoires. L'inscription par téléphone seul n'est pas disponible."},400);
      if (!env.RESEND_API_KEY || !env.UNSUBSCRIBE_FROM_EMAIL) return json({ok:false,error:"Confirmation par email indisponible pour le moment."},503);
      const existing = await env.DB.prepare("SELECT id,active FROM contacts WHERE email=? ORDER BY id DESC LIMIT 1").bind(c.email).first();
      // Same outward response for an already-active subscriber, without revealing status.
      if (!existing || !Number(existing.active)) {
        const token = [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,"0")).join("");
        const tokenHash = await hash(token), now = Math.floor(Date.now()/1000);
        await env.DB.prepare("INSERT INTO contact_optin_tokens(token_hash,email,prenom,telephone,expires_at,created_at) VALUES(?,?,?,?,?,?)").bind(tokenHash,c.email,c.prenom,c.telephone,now+1800,now).run();
        const endpoint = new URL(request.url).origin + "/api/contacts/confirm?token=" + encodeURIComponent(token);
        let mail;
        try { mail = await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:env.UNSUBSCRIBE_FROM_EMAIL,to:[c.email],subject:"Confirmer votre inscription — Balèti Sauvage",text:"Pour confirmer votre inscription, ouvrez ce lien dans les 30 minutes :\n"+endpoint+"\n\nSi vous n'avez rien demandé, ignorez cet email."})}); }
        catch(e) { await env.DB.prepare("DELETE FROM contact_optin_tokens WHERE token_hash=?").bind(tokenHash).run(); return json({ok:false,error:"Impossible d'envoyer la confirmation actuellement."},503); }
        if (!mail.ok) { await env.DB.prepare("DELETE FROM contact_optin_tokens WHERE token_hash=?").bind(tokenHash).run(); return json({ok:false,error:"Impossible d'envoyer la confirmation actuellement."},503); }
        // Only retire older links after Resend accepts the new message.
        // A cleanup failure must not invalidate the newly sent link.
        try { await env.DB.prepare("DELETE FROM contact_optin_tokens WHERE expires_at<?").bind(now).run(); } catch(e) { console.error("Opt-in token cleanup failed",e); }
      }
      return json({ok:true,message:"Si cette adresse peut être inscrite, un email de confirmation sera envoyé."});
    }
    if (p === "/api/contacts/confirm" && (request.method === "GET" || request.method === "POST")) {
      const secureHeaders = {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store, max-age=0","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
      const page = (title, body, status=200) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Balèti Sauvage</title><style>body{font-family:Arial,sans-serif;background:#f4f0e7;color:#17130d;margin:0}main{max-width:560px;margin:12vh auto;padding:24px;border-top:1px solid #17130d}h1{font-family:Georgia,serif;font-weight:500}button{padding:12px 18px;background:#17130d;color:#f4f0e7;border:0;cursor:pointer}</style></head><body><main><h1>${title}</h1>${body}</main></body></html>`,{status,headers:secureHeaders});
      let token = "";
      if (request.method === "GET") token = new URL(request.url).searchParams.get("token") || "";
      else {
        if (!(request.headers.get("content-type")||"").toLowerCase().startsWith("application/x-www-form-urlencoded")) return page("Requête refusée","<p>Formulaire invalide.</p>",415);
        const raw = await request.text(); if(raw.length>512) return page("Requête refusée","<p>Formulaire invalide.</p>",400);
        token = new URLSearchParams(raw).get("token") || "";
      }
      if (!/^[a-f0-9]{64}$/.test(token)) return page("Lien invalide","<p>Ce lien est invalide.</p>",400);
      const tokenHash = await hash(token), now = Math.floor(Date.now()/1000);
      const row = await env.DB.prepare("SELECT email,prenom,telephone,expires_at FROM contact_optin_tokens WHERE token_hash=?").bind(tokenHash).first();
      if (!row || Number(row.expires_at)<=now) return page("Lien expiré","<p>Ce lien a expiré ou a déjà été utilisé.</p>",410);
      if (request.method === "GET") return page("Confirmer l'inscription",`<p>Souhaites-tu recevoir les informations de Balèti Sauvage ?</p><form method="post" action="/api/contacts/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">Confirmer mon inscription</button></form>`);
      // D1 batch is transactional. Do not overwrite existing subscriber data on a public request.
      const result = await env.DB.batch([
        env.DB.prepare("INSERT INTO contacts(prenom,email,telephone,active) SELECT prenom,email,telephone,1 FROM contact_optin_tokens WHERE token_hash=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM contacts WHERE email=(SELECT email FROM contact_optin_tokens WHERE token_hash=?))").bind(tokenHash,now,tokenHash),
        env.DB.prepare("UPDATE contacts SET active=1,updated_at=CURRENT_TIMESTAMP WHERE email=(SELECT email FROM contact_optin_tokens WHERE token_hash=? AND expires_at>?) AND active=0").bind(tokenHash,now),
        // A confirmed subscription supersedes any earlier unsubscribe request.
        env.DB.prepare("DELETE FROM unsubscribe_tokens WHERE email=(SELECT email FROM contact_optin_tokens WHERE token_hash=? AND expires_at>?)").bind(tokenHash,now),
        env.DB.prepare("DELETE FROM contact_optin_tokens WHERE email=(SELECT email FROM contact_optin_tokens WHERE token_hash=? AND expires_at>?)").bind(tokenHash,now)
      ]);
      if (Number(result[3]?.meta?.changes||0)<1) return page("Lien expiré","<p>Ce lien a expiré ou a déjà été utilisé.</p>",410);
      return page("Inscription confirmée","<p>Ton adresse est maintenant inscrite.</p>");
    }
    // Phase 8: email-confirmed unsubscribe. Never deactivate by a bare email/phone.
    if (p === "/api/contacts/unsubscribe" && request.method === "POST") {
      if (await publicRateLimited(request, env, "unsubscribe")) return json({ok:false,error:"Trop de demandes. Réessaie plus tard."},429);
      const b = await request.json();
      const email = String(b.email || "").trim().toLowerCase();
      if (!validEmail(email)) return json({ok:false,error:"Adresse email invalide"},400);
      // A mail provider is required; never promise an email that cannot be delivered.
      if (!env.RESEND_API_KEY || !env.UNSUBSCRIBE_FROM_EMAIL) return json({ok:false,error:"Confirmation par email indisponible pour le moment."},503);
      const existing = await env.DB.prepare("SELECT id FROM contacts WHERE email=? AND active=1 LIMIT 1").bind(email).first();
      // Identical public response for unknown and known email addresses.
      if (existing) {
        const token = [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,"0")).join("");
        const now = Math.floor(Date.now()/1000);
        const tokenHash = await hash(token);
        await env.DB.prepare("INSERT INTO unsubscribe_tokens(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)").bind(tokenHash,email,now+1800,now).run();
        const endpoint = new URL(request.url).origin + "/api/contacts/unsubscribe/confirm?token=" + encodeURIComponent(token);
        let mail; try { mail = await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:env.UNSUBSCRIBE_FROM_EMAIL,to:[email],subject:"Confirmer votre désinscription — Balèti Sauvage",text:"Pour confirmer votre désinscription, ouvrez ce lien dans les 30 minutes :\n"+endpoint+"\n\nSi vous n'avez rien demandé, ignorez cet email."})}); } catch(e) { await env.DB.prepare("DELETE FROM unsubscribe_tokens WHERE token_hash=?").bind(tokenHash).run(); return json({ok:false,error:"Impossible d’envoyer la confirmation actuellement."},503); }
        if (!mail.ok) { await env.DB.prepare("DELETE FROM unsubscribe_tokens WHERE token_hash=?").bind(tokenHash).run(); return json({ok:false,error:"Impossible d'envoyer la confirmation actuellement."},503); }
        try { await env.DB.prepare("DELETE FROM unsubscribe_tokens WHERE expires_at<?").bind(now).run(); } catch(e) { console.error("Unsubscribe token cleanup failed",e); }
      }
      return json({ok:true,message:"Si cette adresse est inscrite, un email de confirmation sera envoyé."});
    }
    // Phase 9: opening an email link never changes contact status.
    if (p === "/api/contacts/unsubscribe/confirm" && (request.method === "GET" || request.method === "POST")) {
      const secureHeaders = {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store, max-age=0","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
      const page = (title, body, status=200) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Balèti Sauvage</title><style>body{font-family:Arial,sans-serif;background:#f4f0e7;color:#17130d;margin:0}main{max-width:560px;margin:12vh auto;padding:24px;border-top:1px solid #17130d}h1{font-family:Georgia,serif;font-weight:500}button{padding:12px 18px;background:#17130d;color:#f4f0e7;border:0;cursor:pointer}</style></head><body><main><h1>${title}</h1>${body}</main></body></html>`,{status,headers:secureHeaders});
      let token = "";
      if (request.method === "GET") token = new URL(request.url).searchParams.get("token") || "";
      else {
        const ct = request.headers.get("content-type") || "";
        if (!ct.toLowerCase().startsWith("application/x-www-form-urlencoded")) return page("Requête refusée","<p>Formulaire invalide.</p>",415);
        const raw = await request.text();
        if (raw.length > 512) return page("Requête refusée","<p>Formulaire invalide.</p>",400);
        token = new URLSearchParams(raw).get("token") || "";
      }
      if (!/^[a-f0-9]{64}$/.test(token)) return page("Lien invalide","<p>Ce lien de désinscription est invalide.</p>",400);
      const tokenHash = await hash(token), now = Math.floor(Date.now()/1000);
      const row = await env.DB.prepare("SELECT email,expires_at FROM unsubscribe_tokens WHERE token_hash=?").bind(tokenHash).first();
      if (!row || Number(row.expires_at) <= now) return page("Lien expiré","<p>Ce lien a expiré ou a déjà été utilisé.</p>",410);
      if (request.method === "GET") return page("Confirmer la désinscription",`<p>Souhaites-tu ne plus recevoir les informations de Balèti Sauvage ?</p><form method="post" action="/api/contacts/unsubscribe/confirm"><input type="hidden" name="token" value="${token}"><button type="submit">Confirmer ma désinscription</button></form>`);
      // Phase 10: D1 batch executes the contact update and token consumption
      // in one transaction. The UPDATE checks that the token still exists and
      // has not expired at execution time, not merely at the earlier SELECT.
      const result = await env.DB.batch([
        env.DB.prepare("UPDATE contacts SET active=0,updated_at=CURRENT_TIMESTAMP WHERE email=(SELECT email FROM unsubscribe_tokens WHERE token_hash=? AND expires_at>?) AND active=1").bind(tokenHash,now),
        // A confirmed unsubscribe also cancels outstanding opt-in requests.
        env.DB.prepare("DELETE FROM contact_optin_tokens WHERE email=(SELECT email FROM unsubscribe_tokens WHERE token_hash=? AND expires_at>?)").bind(tokenHash,now),
        env.DB.prepare("DELETE FROM unsubscribe_tokens WHERE email=(SELECT email FROM unsubscribe_tokens WHERE token_hash=? AND expires_at>?)").bind(tokenHash,now)
      ]);
      if (Number(result[2]?.meta?.changes || 0) < 1) return page("Lien expiré","<p>Ce lien a expiré ou a déjà été utilisé.</p>",410);
      return page("Désinscription confirmée","<p>Ton adresse a été désinscrite.</p>");
    }
    if (p === "/api/public" && request.method === "GET") {

      // Phase 24: do not silently turn an upstream GitHub failure into empty galleries.
      // An explicit 503 allows the public site to distinguish outage from no content.
      let s, o, ph, vi, pa;
      try {
        [s, o, ph, vi, pa] = await Promise.all([settings(env.DB), overrides(env.DB), ...(env.GITHUB_TOKEN ? [photoData(env), videoData(env), paperData(env)] : [Promise.resolve({photos:[]}), Promise.resolve({videos:[]}), Promise.resolve({papers:[]})])]);
      } catch (error) {
        console.error("Public media unavailable", error);
        return json({ok:false,error:"Les galeries sont temporairement indisponibles. Réessaie plus tard."},503,{"Cache-Control":"no-store"});
      }

      // STAGING V7.1: integrate independently published attachments into existing galleries.
      // These rows are independent of their source messages and survive message deletion.
      let published = [];
      try {
        published = (await env.DB.prepare("SELECT id,original_name,kind,title FROM published_attachments ORDER BY published_at DESC").all()).results || [];
      } catch (error) {
        console.error("Published gallery metadata unavailable", error);
        return json({ok:false,error:"Publications temporairement indisponibles"},503,{"Cache-Control":"no-store"});
      }
      const photos = ph.photos.filter(x => x.visible).map(photoPublic);
      const videos = vi.videos.filter(x => x.visible);
      const papers = pa.papers.filter(x => x.visible).map(paperPublic);
      // V7.1 only: use B2 for existing gallery assets without changing GitHub manifests.
      const mediaUrl=(kind,file)=>API_ORIGIN+'/api/media/file?kind='+encodeURIComponent(kind)+'&file='+encodeURIComponent(file);
      for(const [kind,items] of [['photos',photos],['videos',videos],['papiers',papers]]){for(const item of items){if(!item.fichier)continue;const idx=await env.DB.prepare('SELECT b2_file_id FROM b2_file_index WHERE logical_key=?').bind('media:'+kind+':'+item.fichier).first();if(idx)item.url=mediaUrl(kind,item.fichier);}}
      for (const item of published) {
        if (!item?.id) continue;
        const url = `${API_ORIGIN}/api/published/file?id=${encodeURIComponent(item.id)}`;
        const titre = String(item.title || item.original_name || "Sans titre");
        if (item.kind === "photo") photos.push({url,titre,credit:""});
        else if (item.kind === "video") videos.push({url,titre,fichier:`publication-${item.id}`,principale:false});
        else if (item.kind === "document") papers.push({url,titre,nomOriginal:String(item.original_name || "document")});
      }
      return json({ok:true,settings:s,overrides:o,photos,videos,papers},200,{"Cache-Control":"no-store"});

    }

    // STAGING: public media is served from an independent published/ copy.
    if (p === "/api/published" && request.method === "GET") {
      const rows=(await env.DB.prepare("SELECT id,original_name,media_type,title,kind,published_at FROM published_attachments ORDER BY published_at DESC").all()).results||[];
      return json({ok:true,items:rows.map(x=>({...x,url:`${API_ORIGIN}/api/published/file?id=${encodeURIComponent(x.id)}`}))});
    }
    if (p === "/api/published/file" && request.method === "GET") {
      const id=new URL(request.url).searchParams.get("id")||"";
      if(!/^[a-f0-9-]{36}$/.test(id))return json({ok:false,error:"Fichier invalide"},400);
      const m=await env.DB.prepare("SELECT id,media_type,original_name FROM published_attachments WHERE id=?").bind(id).first();
      if(!m)return json({ok:false,error:"Fichier introuvable"},404);
      const bytes=await attachmentGet(env,"published/"+id);
      const safeType=/^(image\/(jpeg|png|webp)|video\/(mp4|webm)|application\/pdf|text\/plain)$/.test(m.media_type)?m.media_type:"application/octet-stream";
      const name=String(m.original_name).replace(/[^a-zA-Z0-9._-]/g,"_");
      return new Response(bytes,{headers:headers({"Content-Type":safeType,"Content-Disposition":`inline; filename="${name}"`,"X-Content-Type-Options":"nosniff","Cache-Control":"public, max-age=300","Content-Security-Policy":"default-src 'none'; sandbox"})});
    }
    if (p === "/api/login" && request.method === "POST") {

      const b = await request.json(), k = await rateKey(request, env);

      if (await blocked(env, k)) return json({ ok: false, error: "Trop de tentatives. R\xE9essaie dans quelques minutes." }, 429);

      if (!env.ADMIN_PASSWORD || !safe(b.password, env.ADMIN_PASSWORD)) {

        await fail(env, k);

        return json({ ok: false, error: "Mot de passe incorrect" }, 401);

      }

      await env.DB.prepare("DELETE FROM admin_login_rate WHERE key=?").bind(k).run();

      const token = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2,"0")).join("");
      const now = Math.floor(Date.now()/1000);
      await env.DB.prepare("INSERT INTO admin_sessions(token_hash,expires_at,created_at) VALUES(?,?,?)").bind(await hash(token),now+SESSION,now).run();
      return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${SESSION}` });

    }

    if (p === "/api/session" && request.method === "GET") return json({ ok: true, authenticated: await auth(request, env) });

    if (p === "/api/logout" && request.method === "POST") {
      const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)baleti_admin=([^;]+)/);
      if (m && /^[a-f0-9]{64}$/.test(m[1])) await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await hash(m[1])).run();
      return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0` });
    }

    if (!await auth(request, env)) return json({ ok: false, error: "Non autoris\xE9" }, 401);

    if(p==="/api/admin/migrate-gallery-v71"&&request.method==="POST"){const q=await request.json().catch(()=>({}));const start=Number(q.start||0);if(!Number.isInteger(start)||start<0||start>10000)return json({ok:false,error:"Index invalide"},400);const manifests=[['photos',PHOTO_MANIFEST],['videos',VIDEO_MANIFEST],['papiers',PAPER_MANIFEST]];const all=[];for(const [kind,path] of manifests){const d=await arrayData(env,path);for(const item of d.items){if(item&&typeof item.fichier==='string'&&item.fichier)all.push({kind,file:item.fichier});}}const slice=all.slice(start,start+2);const results=[];for(const item of slice){try{results.push({...item,...await v71MediaCopy(env,item.kind,item.file)})}catch(e){results.push({...item,status:'échec',error:String(e.message||e).slice(0,160)})}}return json({ok:results.every(x=>x.status!=='échec'),total:all.length,next:start+slice.length,done:start+slice.length>=all.length,results,originalsPreserved:true});}
    if (p === "/api/admin/b2-check" && request.method === "GET") {
      
      try {
        if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID) throw Error("Missing B2 binding");
        const a=await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account",{headers:{Authorization:"Basic "+btoa(env.B2_KEY_ID+":"+env.B2_APPLICATION_KEY)}});
        if (!a.ok) throw Error("Authorization refused");
        const d=await a.json();const st=d.apiInfo?.storageApi;const api=st?.apiUrl||d.apiUrl;const allowed=st?.allowed?.bucketId||d.allowed?.bucketId;
        if (!api||!d.authorizationToken||(allowed&&allowed!==env.B2_BUCKET_ID)) throw Error("Bucket mismatch");
        const u=await fetch(api+"/b2api/v3/b2_get_upload_url",{method:"POST",headers:{Authorization:d.authorizationToken,"Content-Type":"application/json"},body:JSON.stringify({bucketId:env.B2_BUCKET_ID})});
        if(!u.ok)throw Error("Bucket authorization refused");const v=await u.json();if(!v.uploadUrl||!v.authorizationToken)throw Error("Invalid upload authorization");
        return json({ok:true,b2Authorized:true,bucketWriteAuthorized:true,uploaded:false,deleted:false});
      }catch(_){return json({ok:false,error:"Connexion B2 ou accès au bucket refusé",uploaded:false,deleted:false},502);}
    }

    if (p === "/api/admin/github-cleanup" && request.method === "GET") {
      const rows = (await env.DB.prepare("SELECT path,kind,attempts,last_error,created_at FROM github_cleanup_queue ORDER BY created_at LIMIT 100").all()).results || [];
      return json({ok:true,pending:rows});
    }
    if (p === "/api/admin/github-cleanup/retry" && request.method === "POST") {
      return json({ok:true,results:await cleanupGithubQueue(env,20)});
    }

    // Paginated private messages: independent of public GitHub media availability.
    if (p === "/api/admin/messages" && request.method === "GET") {
      const raw = new URL(request.url).searchParams.get("page") || "1";
      if (!/^[1-9]\d{0,5}$/.test(raw)) return json({ok:false,error:"Page invalide"},400);
      const page = Number(raw), limit = 50, offset = (page - 1) * limit;
      const [rows, count] = await Promise.all([
        env.DB.prepare("SELECT m.id,m.prenom,m.contact,m.message,m.date_creation,m.lu,m.attachment_file_id,m.attachment_name,m.attachment_type,m.attachment_size,(SELECT COUNT(*) FROM published_attachments p WHERE p.source_message_id=m.id) AS published_count FROM messages m ORDER BY m.id DESC LIMIT ? OFFSET ?").bind(limit,offset).all(),
        env.DB.prepare("SELECT COUNT(*) AS total FROM messages").first()
      ]);
      return json({ok:true,messages:rows.results || [],page,limit,total:Number(count?.total || 0)});
    }

    if (p === "/api/admin" && request.method === "GET") {

      // Staging sans GITHUB_TOKEN : consultation D1 possible, medias GitHub vides.
      // Les operations d'ecriture GitHub restent bloquees par gh() sans secret.
      const [s, o, l, ph, vi, ms, pa] = await Promise.all([settings(env.DB), overrides(env.DB), locations(env.DB), env.GITHUB_TOKEN ? photoData(env) : Promise.resolve({photos:[]}), env.GITHUB_TOKEN ? videoData(env) : Promise.resolve({videos:[]}), messages(env.DB), env.GITHUB_TOKEN ? paperData(env) : Promise.resolve({papers:[]})]);

      return json({ ok: true, settings: s, overrides: o, locations: l, photos: ph.photos.map(photoPublic), videos: vi.videos, messages: ms, contacts: await contacts(env.DB), papers: pa.papers.map(paperPublic) });

    }

    if (p === "/api/contacts/deactivate" && request.method === "POST") {
      const b = await request.json();
      const ids = Array.isArray(b.contacts) ? b.contacts : [b.id];
      if (!ids.length || ids.length > 200 || ids.some(id => !Number.isSafeInteger(Number(id)) || Number(id) < 1)) return json({ok:false,error:"Identifiants invalides"},400);
      await env.DB.batch([...new Set(ids.map(Number))].map(id => env.DB.prepare("UPDATE contacts SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id)));
      return json({ok:true,contacts:await contacts(env.DB)});
    }
    if (p === "/api/contacts/delete" && request.method === "POST") {
      const b = await request.json();
      const ids = Array.isArray(b.contacts) ? b.contacts : [b.id];
      if (!ids.length || ids.length > 200 || ids.some(id => !Number.isSafeInteger(Number(id)) || Number(id) < 1)) return json({ok:false,error:"Identifiants invalides"},400);
      await env.DB.batch([...new Set(ids.map(Number))].map(id => env.DB.prepare("DELETE FROM contacts WHERE id=?").bind(id)));
      return json({ok:true,contacts:await contacts(env.DB)});
    }
    // STAGING ONLY: explicit opt-in publication creates a separate durable copy.
    if (p === "/api/messages/publish" && request.method === "POST") {
      const b=await request.json(), id=Number(b.id);
      if(!Number.isSafeInteger(id)||id<1||b.confirmRights!==true)return json({ok:false,error:"Autorisation de publication requise"},400);
      const m=await env.DB.prepare("SELECT attachment_file_id,attachment_name,attachment_type,attachment_size FROM messages WHERE id=?").bind(id).first();
      if(!m?.attachment_file_id)return json({ok:false,error:"Pièce jointe introuvable"},404);
      const name=String(m.attachment_name||"fichier"),type=String(m.attachment_type||"");
      const kind=/^image\/(jpeg|png|webp)$/.test(type)?"photo":/^video\/(mp4|webm)$/.test(type)?"video":/^(application\/pdf|text\/plain)$/.test(type)?"document":null;
      if(!kind)return json({ok:false,error:"Format non publiable dans cette version de test"},415);
      if(Number(m.attachment_size)>8*1024*1024)return json({ok:false,error:"Publication limitée à 8 Mo"},413);
      const title=String(b.title||name).trim().slice(0,100);
      if(!title)return json({ok:false,error:"Titre obligatoire"},400);
      const existing=await env.DB.prepare("SELECT id FROM published_attachments WHERE source_message_id=? AND original_name=?").bind(id,name).first();
      if(existing)return json({ok:true,alreadyPublished:true,publishedId:existing.id});
      const bytes=await attachmentGet(env,m.attachment_file_id);
      const publishedId=crypto.randomUUID();
      await attachmentPut(env,"published/"+publishedId,bytes);
      try{await env.DB.prepare("INSERT INTO published_attachments(id,source_message_id,original_name,media_type,title,kind) VALUES(?,?,?,?,?,?)").bind(publishedId,id,name,type,title,kind).run();}
      catch(e){try{await attachmentDelete(env,"published/"+publishedId)}catch(_){}throw e;}
      return json({ok:true,publishedId});
    }
    if(p==="/api/published/admin"&&request.method==="GET"){
      const rows=(await env.DB.prepare("SELECT * FROM published_attachments ORDER BY published_at DESC").all()).results||[];
      return json({ok:true,items:rows});
    }
    if(p==="/api/published/delete"&&request.method==="POST"){
      const b=await request.json();if(!/^[a-f0-9-]{36}$/.test(String(b.id||"")))return json({ok:false,error:"ID invalide"},400);
      const m=await env.DB.prepare("SELECT id FROM published_attachments WHERE id=?").bind(b.id).first();
      if(!m)return json({ok:false,error:"Introuvable"},404);
      await env.DB.prepare("DELETE FROM published_attachments WHERE id=?").bind(b.id).run();
      try{await attachmentDelete(env,"published/"+b.id)}catch(e){console.error("Published file cleanup failed",e)}
      return json({ok:true});
    }
    if (p === "/api/messages/attachment" && request.method === "GET") {
      const id = Number(new URL(request.url).searchParams.get("id"));
      if (!Number.isSafeInteger(id) || id < 1) return json({ok:false,error:"Identifiant invalide"},400);
      const m = await env.DB.prepare("SELECT attachment_file_id,attachment_name,attachment_type FROM messages WHERE id=?").bind(id).first();
      if (!m?.attachment_file_id) return json({ok:false,error:"Pièce jointe introuvable"},404);
      if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID) return json({ok:false,error:"Stockage B2 indisponible"},503);
      const file = await attachmentGet(env, m.attachment_file_id);
      if (!file) return json({ok:false,error:"Fichier introuvable"},404);
      const name = String(m.attachment_name || "piece-jointe").replace(/["\r\n\\]/g,"_");
      return new Response(file,{headers:headers({"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="${name.replace(/[^\x20-\x7e]/g,"_")}"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"})});
    }
    if (p === "/api/messages/read" && request.method === "POST") {

      const b = await request.json(), id = Number(b.id);

      if (!Number.isSafeInteger(id) || id < 1) return json({ ok: false, error: "Message introuvable." }, 400);

      await env.DB.prepare("UPDATE messages SET lu=1 WHERE id=?").bind(id).run();

      return json({ ok: true, messages: await messages(env.DB) });

    }

    if (p === "/api/messages/delete" && request.method === "POST") {

      const b = await request.json(), id = Number(b.id);

      if (!Number.isSafeInteger(id) || id < 1) return json({ ok: false, error: "Message introuvable." }, 400);

      const old = await env.DB.prepare("SELECT attachment_file_id FROM messages WHERE id=?").bind(id).first();
      if (!old) return json({ok:false,error:"Message introuvable"},404);
      // Delete the private blob first: on R2 failure, keep the D1 reference for retry.
      if (old.attachment_file_id) {
        if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID) return json({ok:false,error:"Stockage B2 indisponible"},503);
        try { await attachmentDelete(env, old.attachment_file_id); }
        catch (error) { console.error("R2 attachment deletion failed", error); return json({ok:false,error:"Suppression du fichier impossible. Message conservé, réessayez."},503); }
      }
      await env.DB.prepare("UPDATE published_attachments SET source_message_id=NULL WHERE source_message_id=?").bind(id).run();
      await env.DB.prepare("DELETE FROM messages WHERE id=?").bind(id).run();

      return json({ ok: true, messages: await messages(env.DB) });

    }

// Capture une annonce immuable lors de la préparation du programme habituel.
// Les dates sont calculées dans le fuseau Europe/Paris, indépendamment du serveur.
function parisCivilDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
}
function isoDay(d) { return d.toISOString().slice(0,10); }
function nextWeeklyDate(mode, today) {
  const d = new Date(today + "T12:00:00Z"), target = mode === "sun" ? 0 : 4;
  d.setUTCDate(d.getUTCDate() + (target - d.getUTCDay() + 7) % 7);
  return isoDay(d);
}
function previousAnnouncement(oldSettings, oldOverrides, today) {
  const next = nextWeeklyDate(oldSettings.mode, today);
  const d = new Date(next + "T12:00:00Z"); d.setUTCDate(d.getUTCDate()-7);
  const date = isoDay(d), o = oldOverrides.find(x=>x.event_date===date)||{};
  return {date, time:o.time||(oldSettings.mode==="sun"?"14:00":"21:30"),
    place:o.place||oldSettings.usualPlace||"", comment:o.comment||"",
    cancelled:o.cancelled===true||o.cancelled===1||o.cancelled==="1",
    lat:o.lat??oldSettings.usualLat, lng:o.lng??oldSettings.usualLng};
}
    if (p === "/api/habitual" && request.method === "POST") {

      const b = await request.json();

      if (!["thu", "sun"].includes(b.mode) || !String(b.place || "").trim() || !coordsOK(b.lat,b.lng)) return json({ ok: false, error: "Programme invalide" }, 400);

      const oldSettings = await settings(env.DB);
      const today = parisCivilDay();
      const next = nextWeeklyDate(b.mode, today);
      const reveal = new Date(next + "T12:00:00Z"); reveal.setUTCDate(reveal.getUTCDate()-2);
      // Conserver le cliché initial jusqu'à sa date de révélation, même si
      // l'administrateur modifie plusieurs fois le programme entre-temps.
      const existing = oldSettings.announcementHold;
      const hold = existing && today < existing.revealDate ? existing : {
        revealDate:isoDay(reveal), event:previousAnnouncement(oldSettings, await overrides(env.DB), today)
      };
      await save(env.DB, "announcementHold", hold);
      await Promise.all([save(env.DB, "mode", b.mode), save(env.DB, "usualPlace", String(b.place).trim()), save(env.DB, "usualLat", +b.lat), save(env.DB, "usualLng", +b.lng)]);

      await env.DB.prepare("INSERT INTO locations(name,lat,lng,latitude,longitude,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)").bind(String(b.place).trim(), +b.lat, +b.lng, +b.lat, +b.lng).run();

      return json({ ok: true });

    }

    if (p === "/api/override" && request.method === "POST") {

      const b = await request.json();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "") || Number.isNaN(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0,10) !== b.date) return json({ ok: false, error: "Date invalide" }, 400);
      if (b.time != null && b.time !== "" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.time)) return json({ok:false,error:"Heure invalide"},400);
      if ((b.lat == null) !== (b.lng == null)) return json({ok:false,error:"Coordonnées incomplètes"},400);
      if (b.lat != null && !coordsOK(b.lat,b.lng)) return json({ok:false,error:"Coordonnées invalides"},400);
      if (String(b.place||"").length > 200 || String(b.comment||"").length > 2000) return json({ok:false,error:"Texte trop long"},400);

      await env.DB.prepare("INSERT INTO event_overrides(event_date,time,place,lat,lng,comment,cancelled,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(event_date) DO UPDATE SET time=excluded.time,place=excluded.place,lat=excluded.lat,lng=excluded.lng,comment=excluded.comment,cancelled=excluded.cancelled,updated_at=CURRENT_TIMESTAMP").bind(b.date, b.time || null, b.place || null, b.lat == null ? null : +b.lat, b.lng == null ? null : +b.lng, String(b.comment || ""), b.cancelled ? 1 : 0).run();

      if (b.place && b.lat != null && coordsOK(b.lat,b.lng)) await env.DB.prepare("INSERT INTO locations(name,lat,lng,latitude,longitude,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)").bind(String(b.place).trim(), +b.lat, +b.lng, +b.lat, +b.lng).run();

      return json({ ok: true });

    }

    if (p === "/api/override/clear" && request.method === "POST") {

      const b = await request.json();

      if (typeof b.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || Number.isNaN(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0,10) !== b.date) return json({ok:false,error:"Date invalide"},400);
      await env.DB.prepare("DELETE FROM event_overrides WHERE event_date=?").bind(b.date).run();

      return json({ ok: true });

    }

    if (p === "/api/presentation" && request.method === "POST") {

      await save(env.DB, "baletiText", String((await request.json()).text || ""));

      return json({ ok: true });

    }

    if (p === "/api/links" && request.method === "POST") {

      const body = await request.json();
      if (!body || !Array.isArray(body.links) || body.links.length > 50 || body.links.some(x => !x || typeof x.title !== "string" || !x.title.trim() || x.title.length > 120 || typeof x.url !== "string" || x.url.length > 1000 || !validHttpUrl(x.url))) return json({ok:false,error:"Liste de liens invalide (maximum 50 liens, titres et URL http(s) obligatoires)."},400);
      const l = cleanLinks(body.links);

      await save(env.DB, "links", l);

      return json({ ok: true, links: l });

    }

    if(p==='/api/admin/gallery-v71/health/deep'&&request.method==='GET'){const report=[];let ok=true;const a=await v71B2Auth(env);for(const [kind,path] of [['photos',PHOTO_MANIFEST],['videos',VIDEO_MANIFEST],['papiers',PAPER_MANIFEST]]){const d=await arrayData(env,path);for(const item of d.items){const file=item?.fichier;if(typeof file!=='string'||!/^[A-Za-z0-9_.-]{1,180}$/.test(file)){ok=false;report.push({kind,file:null,ok:false,reason:'Nom invalide'});continue;}const row=await env.DB.prepare('SELECT b2_file_id,b2_file_name FROM b2_file_index WHERE logical_key=?').bind('media:'+kind+':'+file).first();if(!row?.b2_file_id||row.b2_file_name!=='media/'+kind+'/'+file){ok=false;report.push({kind,file,ok:false,reason:'Index absent'});continue;}try{const res=await fetch(a.api+'/b2api/v2/b2_download_file_by_id?fileId='+encodeURIComponent(row.b2_file_id),{headers:{Authorization:a.token,Range:'bytes=0-0'}});const valid=(res.status===206||res.status===200);if(res.body)await res.body.cancel();if(!valid)ok=false;report.push({kind,file,ok:valid,httpStatus:res.status});}catch(e){ok=false;report.push({kind,file,ok:false,reason:'Lecture B2 impossible'});}}}return json({ok,checked:report.length,report},ok?200:502);}
    if(p==='/api/admin/gallery-v71/health'&&request.method==='GET'){const report=[];let ok=true;for(const [kind,path] of [['photos',PHOTO_MANIFEST],['videos',VIDEO_MANIFEST],['papiers',PAPER_MANIFEST]]){const d=await arrayData(env,path);const files=new Set();let missing=0,invalid=0,duplicates=0;for(const item of d.items){const name=item?.fichier;if(typeof name!=='string'||!/^[A-Za-z0-9_.-]{1,180}$/.test(name)){invalid++;continue;}if(files.has(name)){duplicates++;continue;}files.add(name);const row=await env.DB.prepare('SELECT b2_file_id,b2_file_name FROM b2_file_index WHERE logical_key=?').bind('media:'+kind+':'+name).first();if(!row?.b2_file_id||row.b2_file_name!=='media/'+kind+'/'+name)missing++;}const indexed=await env.DB.prepare('SELECT b2_file_name FROM b2_file_index WHERE logical_key LIKE ?').bind('media:'+kind+':%').all();let orphaned=0;for(const row of indexed.results||[]){const name=String(row.b2_file_name||'').slice(('media/'+kind+'/').length);if(!row.b2_file_name?.startsWith('media/'+kind+'/')||!files.has(name))orphaned++;}if(missing||invalid||duplicates||orphaned)ok=false;report.push({kind,total:d.items.length,missing,invalid,duplicates,orphaned});}return json({ok,report,note:'Contrôle des manifestes et de l’index D1 uniquement ; ne vérifie pas le contenu distant B2.'});}
    if(p==='/api/admin/gallery-v71'&&request.method==='GET'){const rows=await env.DB.prepare('SELECT path,content FROM staging_gallery_manifests').all();return json({ok:true,manifests:rows.results});}
    if(p==='/api/admin/gallery-v71/upload'&&request.method==='POST'){const f=await boundedAdminForm(request);const kind=String(f.get('kind')||'');const file=f.get('file');if(!['photos','videos','papiers'].includes(kind)||!file?.size)return json({ok:false,error:'Fichier manquant'},400);const mime=kind==='photos'?'image/jpeg':kind==='videos'?'video/mp4':'application/pdf';if(file.type!==mime||file.size>8*1024*1024)return json({ok:false,error:'Format ou taille non autorisé (8 Mo maximum)'},400);const bytes=await file.arrayBuffer();if(kind!=='videos'&&!validFileSignature(file,bytes))return json({ok:false,error:'Signature de fichier invalide'},400);if(kind==='videos'){const v=new Uint8Array(bytes);if(v.length<12||String.fromCharCode(...v.slice(4,8))!=='ftyp'||!['isom','iso2','mp41','mp42','avc1','M4V ','MSNV','dash'].includes(String.fromCharCode(...v.slice(8,12))))return json({ok:false,error:'Fichier MP4 invalide'},400);}const ext=kind==='photos'?'jpg':kind==='videos'?'mp4':'pdf';const name='v71-'+crypto.randomUUID()+'.'+ext;await v71GalleryPut(env,kind,name,bytes,mime);const path=kind==='photos'?PHOTO_MANIFEST:kind==='videos'?VIDEO_MANIFEST:PAPER_MANIFEST;const d=await arrayData(env,path);const item=kind==='photos'?{fichier:name,titre:String(f.get('title')||''),visible:true,principale:false,ajouteLe:new Date().toISOString()}:kind==='videos'?{fichier:name,titre:String(f.get('title')||''),url:'/api/media/file?kind=videos&file='+name,direct:true,visible:true,ajouteLe:new Date().toISOString()}:{fichier:name,titre:String(f.get('title')||''),nomOriginal:file.name,visible:true,taille:file.size,ajouteLe:new Date().toISOString()};try{await saveArray(env,path,[item,...d.items],d.file?.sha,'V7.1')}catch(e){let cleaned=false;try{await v71GalleryDelete(env,kind,name);cleaned=true}catch(cleanupError){}return json({ok:false,error:cleaned?'Enregistrement annulé, fichier de test nettoyé':'Enregistrement annulé ; nettoyage B2 nécessaire',retry:cleaned,status:e.status||500},e.status||500)}return json({ok:true,file:name,kind});}
    if(p==='/api/admin/gallery-v71/delete'&&request.method==='POST'){const b=await request.json();const kind=String(b.kind||''),file=String(b.file||'');if(!['photos','videos','papiers'].includes(kind)||!/^v71-[a-f0-9-]{36}\.(jpg|mp4|pdf)$/.test(file))return json({ok:false,error:'Suppression limitée aux nouveaux fichiers V7.1'},400);const path=kind==='photos'?PHOTO_MANIFEST:kind==='videos'?VIDEO_MANIFEST:PAPER_MANIFEST;const d=await arrayData(env,path);if(!d.items.some(x=>x.fichier===file))return json({ok:false,error:'Introuvable'},404);await saveArray(env,path,d.items.filter(x=>x.fichier!==file),d.file?.sha,'V7.1');try{await v71GalleryDelete(env,kind,file)}catch(e){return json({ok:true,warning:'Retiré de la galerie ; nettoyage B2 en attente'})}return json({ok:true});}
    // Staging protection: gallery mutations must never write or delete the official GitHub repository.
    if (p === "/api/photos/upload" && request.method === "POST") { try { return json({ ok: true, photos: await uploadPhoto(request, env) }); } catch (e) { if (e.status === 413) return json({ok:false,error:e.message},413); throw e; } }

    if (p === "/api/photos/update" && request.method === "POST") {

      const b = await request.json(), d = await photoData(env);

      let ok = false, ps = d.photos, main = !!b.principale;

      ps = ps.map((x) => {

        if (x.fichier === b.fichier) {

          ok = true;

          return cleanPhoto({ ...x, ...b, visible: main || !!b.visible, principale: main });

        }

        return main ? { ...x, principale: false } : x;

      });

      if (!ok) return json({ ok: false, error: "Photo introuvable" }, 404);

      await savePhotos(env, ps, d.file?.sha, "Mise \xE0 jour photo Bal\xE8ti Sauvage");

      return json({ ok: true, photos: ps.map(photoPublic) });

    }

    if (p === "/api/photos/delete" && request.method === "POST") {

      const b = await request.json(), d = await photoData(env), name = String(b.fichier || "");
      if (!/^[a-zA-Z0-9_-]+\.jpg$/.test(name) || !d.photos.some(x => x.fichier === name)) return json({ok:false,error:"Photo invalide"},400);
      // Update the manifest first: a failed manifest write must not delete a referenced file.
      const ps = d.photos.filter((x) => x.fichier !== name);
      await savePhotos(env,ps,d.file?.sha,"Retrait de la galerie");
      return json({ok:true,photos:ps.map(photoPublic)});
    }

    if (p === "/api/papers/upload" && request.method === "POST") { try { return json({ ok: true, papers: await uploadPaper(request, env) }); } catch (e) { if (e.status === 413) return json({ok:false,error:e.message},413); throw e; } }

    if (p === "/api/papers/update" && request.method === "POST") {

      const b = await request.json(), d = await paperData(env);

      let ok = false, ps = d.papers.map((x) => {

        if (x.fichier === b.fichier) {

          ok = true;

          return cleanPaper({ ...x, titre: b.titre, visible: !!b.visible });

        }

        return x;

      });

      if (!ok) return json({ ok: false, error: "Papier introuvable" }, 404);

      await savePapers(env, ps, d.file?.sha, "Mise \xE0 jour papier Bal\xE8ti Sauvage");

      return json({ ok: true, papers: ps.map(paperPublic) });

    }

    if (p === "/api/papers/delete" && request.method === "POST") {

      const b = await request.json(), d = await paperData(env), name = String(b.fichier || "");
      if (!/^[a-zA-Z0-9_-]+\.(pdf|doc|docx|odt|rtf|txt)$/i.test(name) || !d.papers.some(x => x.fichier === name)) return json({ok:false,error:"Document invalide"},400);
      // Never delete a file while its manifest entry is still present.
      const ps = d.papers.filter((x) => x.fichier !== name);
      await savePapers(env,ps,d.file?.sha,"Retrait de la galerie");
      return json({ok:true,papers:ps.map(paperPublic)});
    }

    if (p === "/api/videos/add" && request.method === "POST") {

      const b = await request.json(), id = youtubeId(b.url);

      if (!String(b.titre || "").trim()) return json({ ok: false, error: "Indique le titre de la vid\xE9o." }, 400);

      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return json({ ok: false, error: "Le lien YouTube n\u2019est pas reconnu." }, 400);

      if (b.dateVideo && (!/^\d{4}-\d{2}-\d{2}$/.test(b.dateVideo) || Number.isNaN(Date.parse(b.dateVideo)) || new Date(b.dateVideo).toISOString().slice(0,10) !== b.dateVideo)) return json({ ok: false, error: "Date de vid\xE9o invalide." }, 400);

      const d = await videoData(env);

      let vs = d.videos;

      if (b.principale) vs = vs.map((v) => ({ ...v, principale: false }));

      vs.unshift(cleanVideo({ titre: b.titre, youtubeId: id, dateVideo: b.dateVideo, evenement: b.evenement, visible: b.visible !== false, principale: !!b.principale, ajouteLe: (/* @__PURE__ */ new Date()).toISOString() }));

      await saveVideos(env, vs, d.file?.sha, `Ajout vid\xE9o Bal\xE8ti Sauvage : ${b.titre}`);

      return json({ ok: true, videos: vs });

    }

    if (p === "/api/videos/update" && request.method === "POST") {

      const b = await request.json(), d = await videoData(env);

      let found = false, vs = d.videos, main = !!b.principale;

      vs = vs.map((v) => {

        if (v.youtubeId === b.youtubeId) {

          found = true;

          return cleanVideo({ ...v, ...b, visible: main || b.visible !== false, principale: main });

        }

        return main ? { ...v, principale: false } : v;

      });

      if (!found) return json({ ok: false, error: "Vid\xE9o introuvable." }, 404);

      await saveVideos(env, vs, d.file?.sha, `Mise \xE0 jour vid\xE9o Bal\xE8ti Sauvage : ${b.titre || b.youtubeId}`);

      return json({ ok: true, videos: vs });

    }

    if (p === "/api/videos/delete" && request.method === "POST") {

      const b = await request.json(), d = await videoData(env), vs = d.videos.filter((v) => v.youtubeId !== b.youtubeId);

      if (vs.length === d.videos.length) return json({ ok: false, error: "Vid\xE9o introuvable." }, 404);

      await saveVideos(env, vs, d.file?.sha, "Suppression vid\xE9o Bal\xE8ti Sauvage");

      return json({ ok: true, videos: vs });

    }

    return json({ ok: false, error: "Route inconnue" }, 404);

  } catch (e) {

    if (e?.status === 409) return json({ok:false,error:"Conflit de modification GitHub. Rechargez la galerie avant de réessayer."},409);
    if ([400,413,415].includes(e?.status)) return json({ok:false,error:e.message},e.status);
    return json({ ok: false, error: "Erreur Worker", detail: undefined }, 500);

  }

} };

export {

  worker_default as default

};


