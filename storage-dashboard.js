(() => {
  const root = document.getElementById('storageQuota');
  const refresh = document.getElementById('storageRefresh');
  if (!root || !refresh) return;
  const api = location.hostname === 'baleti-admin-secure.baletisauvage.workers.dev' ? location.origin : 'https://baleti-sauvage.baletisauvage.workers.dev';
  let busy = false;
  const bytes = n => {
    if (!Number.isFinite(n)) return 'Non mesuré';
    const unit=n>=1e9?'Go':n>=1e6?'Mo':n>=1e3?'ko':'octets';
    const scale=unit==='Go'?1e9:unit==='Mo'?1e6:unit==='ko'?1e3:1;
    return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:unit==='octets'?0:2}).format(n/scale)+' '+unit;
  };
  const date = value => new Date(value).toLocaleString('fr-FR',{timeZone:'Europe/Paris'});
  const row = (box,label,value) => {
    const line=document.createElement('div');line.className='storage-line';
    const name=document.createElement('span'),number=document.createElement('strong');
    name.textContent=label;number.textContent=value;line.append(name,number);box.appendChild(line);
  };
  const note = (box,text) => {const e=document.createElement('small');e.textContent=text;box.appendChild(e);};
  const card = title => {const box=document.createElement('div');box.className='storage-box';const h=document.createElement('strong');h.className='title';h.textContent=title;box.appendChild(h);root.appendChild(box);return box;};
  const meter = (box,data) => {
    const labels={ok:'Marge disponible',warning:'Alerte : 80 % du seuil atteint',critical:'Alerte : 95 % du seuil atteint',exceeded:'Seuil atteint ou dépassé'};
    const line=document.createElement('p');line.className='quota-state quota-'+data.level;line.textContent=labels[data.level]+' · '+new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(data.percent)+' %';
    const p=document.createElement('progress');p.max=100;p.value=Math.min(100,data.percent);p.className='quota-progress quota-'+data.level;p.setAttribute('aria-label','Part du seuil de stockage utilisée');box.append(p,line);
  };
  const unavailable = (box,data) => {note(box,data?.error||'Mesure indisponible. Aucun espace libre ne peut être confirmé.');};
  const render = report => {
    root.replaceChildren();
    const b2=card('Backblaze B2 · stockage réel'),b=report.b2;
    if(b?.available===false||!Number.isFinite(b?.usedBytes))unavailable(b2,b);
    else{
      row(b2,b.accountComplete?'Occupé sur le compte':'Occupé dans le bucket accessible',bytes(b.usedBytes));
      row(b2,'Stockage gratuit du compte',bytes(b.limitBytes));
      row(b2,b.accountComplete?'Gratuit restant sur le compte':'Marge maximale pour ce bucket',bytes(b.remainingBytes));
      meter(b2,b);
      row(b2,'Galerie',bytes(b.groups.gallery));row(b2,'Pièces jointes privées',bytes(b.groups.messages));row(b2,'Copies publiées',bytes(b.groups.published));row(b2,'Copies de test',bytes(b.groups.test));
      if(b.groups.other)row(b2,'Autres fichiers',bytes(b.groups.other));
      row(b2,'Dont anciennes versions (déjà incluses)',bytes(b.oldVersionBytes));
      if(b.unfinishedFiles)row(b2,'Dont transferts inachevés (déjà inclus)',bytes(b.unfinishedBytes));
      note(b2,'Toutes les versions et les fragments de transferts inachevés sont comptés. Relevé : '+date(b.checkedAt)+'.');
      if(!b.accountComplete)note(b2,'Attention : les 10 Go gratuits sont partagés par tout le compte B2. Les autres buckets ne sont pas vérifiables avec cet accès ; la marge affichée n’est pas une garantie au niveau du compte.');
      if(b.stale)note(b2,b.error);
    }
    const d1=card('Cloudflare D1 · données'),d=report.d1;
    if(d?.available===false)unavailable(d1,d);
    else{
      row(d1,'Base de production utilisée',bytes(d.usedBytes));row(d1,'Limite par base en offre gratuite',bytes(d.limitBytes));row(d1,'Libre dans cette base',bytes(d.remainingBytes));meter(d1,d);
      if(d.account){row(d1,'Compte D1 utilisé (estimation)',bytes(d.account.usedBytes));row(d1,'Stockage gratuit du compte',bytes(d.account.limitBytes));row(d1,'Gratuit restant (estimation)',bytes(d.account.remainingBytes));meter(d1,d.account);note(d1,'Production mesurée maintenant ; autres bases : dernier relevé du '+date(d.account.otherDatabasesCheckedAt)+' ('+d.account.knownDatabaseCount+' bases connues). Une nouvelle base ou une modification des autres bases peut changer cette marge.');}
      else note(d1,'La marge totale du compte n’est pas disponible ; elle est partagée entre toutes les bases.');
    }
    const gh=card('GitHub · dépôt et site'),g=report.github;
    if(g?.available===false)unavailable(gh,g);
    else{
      row(gh,'Dépôt, historique inclus (approx.)',bytes(g.repository.usedBytes));row(gh,'Taille recommandée pour le dépôt',bytes(g.repository.limitBytes));row(gh,'Marge avant cette recommandation',bytes(g.repository.remainingBytes));meter(gh,g.repository);
      row(gh,'Fichiers actuels du site (estimation)',bytes(g.siteEstimate.usedBytes));row(gh,'Plafond du site publié',bytes(g.siteEstimate.limitBytes));row(gh,'Marge indicative du site',bytes(g.siteEstimate.remainingBytes));meter(gh,g.siteEstimate);
      note(gh,'Le dépôt et le site publié sont deux mesures distinctes. La taille des fichiers versionnés estime le site : elle ne mesure pas exactement le résultat publié. La recommandation du dépôt n’est pas un quota gratuit facturé au dépassement. Relevé : '+date(g.checkedAt)+'.');
      if(g.stale)note(gh,g.error);
    }
  };
  async function load(force=false){
    if(busy)return;busy=true;refresh.disabled=true;
    const status=document.getElementById('storageQuotaStatus');status.textContent='Mesure du stockage en cours…';
    try{
      const response=await fetch(api+'/api/admin/storage'+(force?'/refresh':''),{method:force?'POST':'GET',credentials:'include'});
      const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Mesure indisponible');
      render(data);status.textContent='Alerte à 80 %, critique à 95 %. Les relevés B2 et GitHub sont conservés 15 minutes ; une actualisation manuelle est possible une fois par minute.';
    }catch(error){status.textContent='Impossible de mesurer le stockage : '+error.message+'. Aucun espace libre supplémentaire ne peut être confirmé.';}
    finally{busy=false;refresh.disabled=false;}
  }
  refresh.addEventListener('click',()=>load(true));
  const visible=()=>!document.getElementById('admin').classList.contains('hidden')&&!document.getElementById('storagePanel')?.classList.contains('hidden');
  document.addEventListener('baleti:adminloaded',()=>{if(visible())load(false);});
  document.addEventListener('baleti:storageopened',()=>{if(visible())load(false);});
  if(visible())load(false);
})();
