(() => {
  'use strict';
  const button=document.getElementById('installSite'),help=document.getElementById('contactHelp');
  if(!button||!help)return;
  const ua=navigator.userAgent,platform=navigator.platform||'';
  const ios=/iPhone|iPad|iPod/.test(ua)||(platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const android=/Android/.test(ua),mobile=ios||android;
  const windows=!mobile&&/Win/.test(platform),mac=!mobile&&/Mac/.test(platform);
  const firefox=/Firefox\//.test(ua),safari=/Safari/.test(ua)&&!/Chrome|Chromium|Edg/.test(ua);
  const standalone=window.matchMedia('(display-mode: standalone)');
  let installedHere=false;
  const installed=()=>installedHere||standalone.matches||navigator.standalone===true;
  let promptEvent=null;
  const iconUrl=new URL('favicon_baleti_original.ico',document.baseURI).href;
  const setButton=label=>{
    const icon=document.createElement('img');icon.src=iconUrl;icon.alt='';icon.width=32;icon.height=32;icon.draggable=false;
    const text=document.createElement('span');text.textContent=label;const arrow=document.createElement('span');arrow.className='install-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';button.replaceChildren(icon,text,arrow);
    button.disabled=false;
  };
  const defaultLabel='Installer Balèti';
  const destination=document.getElementById('installDestination');
  if(destination)destination.textContent=mobile?'Retrouve son icône sur ton écran d’accueil.':windows?'Retrouve son icône dans ta barre des tâches.':mac?'Retrouve son icône dans le Dock.':'Ouvre le site en un clic depuis son icône.';
  const guide=(title,steps,detail='',url='')=>{
    let box=document.getElementById('baletiInstallGuide');
    if(!box){box=document.createElement('section');box.id='baletiInstallGuide';help.parentNode.insertBefore(box,help.nextSibling);}
    box.replaceChildren();box.style.cssText='margin-top:16px;padding:18px;border:1px solid currentColor;line-height:1.6';
    const heading=document.createElement('h4');heading.textContent=title;heading.style.cssText='margin:0 0 12px;font-size:17px';
    const preview=document.createElement('img');preview.src=iconUrl;preview.alt='Icône Balèti Sauvage';preview.width=56;preview.height=56;preview.draggable=false;preview.style.cssText='display:block;margin:0 0 14px';
    const list=document.createElement('ol');list.style.cssText='margin:0;padding-left:24px';
    for(const text of steps){const li=document.createElement('li');li.textContent=text;li.style.marginBottom='10px';list.appendChild(li);}
    box.append(heading,preview,list);
    if(detail){const p=document.createElement('p');p.textContent=detail;p.style.cssText='font-size:13px;margin:14px 0 0';box.appendChild(p);}
    if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent='Voir les étapes illustrées de Firefox';link.style.cssText='display:inline-block;color:inherit;text-decoration:underline;margin-top:12px';box.appendChild(link);}
  };
  const pinWindows=()=>guide('Garder l’icône Balèti dans la barre des tâches',[
    'Ouvre l’application Balèti Sauvage.',
    'Dans la barre des tâches Windows, fais un clic droit sur son icône Balèti.',
    'Choisis « Épingler à la barre des tâches ». L’icône restera présente après la fermeture.'
  ]);
  const showGuide=()=>{
    help.textContent='';
    if(windows&&installed()){pinWindows();return;}
    if(ios){guide('L’icône Balèti sur l’écran d’accueil',[
      'Dans le navigateur, ouvre le menu Partager.',
      'Choisis « Sur l’écran d’accueil ». Selon le navigateur, cette option peut se trouver dans son menu.',
      'Confirme avec « Ajouter ». Ouvre ensuite Balèti depuis son icône.'
    ]);return;}
    if(windows&&firefox){guide('Installer Balèti dans la barre des tâches',[
      'En haut de Firefox, clique sur le bouton « Applications web » dans la barre d’adresse.',
      'Firefox ajoute Balèti comme application, avec son icône, et l’ouvre dans sa propre fenêtre.',
      'Si Windows te propose d’épingler l’application à la barre des tâches, clique sur « Oui ». Sinon, fais un clic droit sur l’icône Balèti ouverte puis choisis « Épingler à la barre des tâches ».'
    ],'Cette fonction demande Firefox 143 ou plus récent sous Windows, ou Firefox 150 si installé depuis le Microsoft Store. Elle n’est pas disponible en navigation privée. Le site ne peut pas cliquer sur les commandes Firefox ou Windows à ta place.','https://support.mozilla.org/fr/kb/applications-web-firefox-windows');return;}
    if(mac&&safari){guide('L’icône Balèti dans le Dock',[
      'Dans Safari, ouvre le menu « Fichier ».',
      'Choisis « Ajouter au Dock », puis confirme le nom Balèti Sauvage.',
      'Ouvre ensuite le site depuis son icône dans le Dock.'
    ]);return;}
    if(firefox&&!mobile){guide('Installer Balèti sur cet ordinateur',[
      'L’installation d’applications web de Firefox est disponible sous Windows ; elle n’est pas proposée dans Firefox sur macOS ou Linux.',
      'Ouvre le site dans un navigateur prenant en charge l’installation, comme Chrome ou Edge, puis utilise son option d’installation.'
    ]);return;}
    if(android){guide('L’icône Balèti sur l’écran d’accueil',[
      'Ouvre le menu du navigateur.',
      'Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil », selon l’option proposée.',
      'Confirme l’ajout, puis ouvre Balèti depuis son icône.'
    ]);return;}
    guide(windows?'Installer Balèti dans la barre des tâches':'Installer Balèti sur cet appareil',[
      'Utilise l’option d’installation du site dans la barre d’adresse ou dans le menu du navigateur.',
      'Confirme l’installation de Balèti Sauvage.',
      windows?'Dans la barre des tâches, fais un clic droit sur l’icône Balèti ouverte et choisis « Épingler à la barre des tâches ».':'Ouvre Balèti depuis l’icône créée par le navigateur.'
    ]);
  };
  const updateInstalled=()=>{
    if(!installed()){setButton(defaultLabel);return;}
    if(windows){setButton('Épingler Balèti');help.textContent='Balèti est ouvert comme application. Tu peux maintenant conserver son icône dans la barre des tâches.';}
    else{setButton('Balèti est installé');button.disabled=true;help.textContent='Tu ouvres déjà Balèti depuis son icône.';}
  };
  help.setAttribute('role','status');help.setAttribute('aria-live','polite');
  setButton(defaultLabel);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;setButton(defaultLabel);});
  window.addEventListener('appinstalled',()=>{installedHere=true;promptEvent=null;if(windows){setButton('Épingler Balèti');help.textContent='L’installation a été acceptée. L’épinglage à la barre des tâches est une étape distincte.';pinWindows();}else{setButton('Balèti est installé');button.disabled=true;help.textContent='Installation acceptée. Retrouve l’icône Balèti sur ton appareil.';}});
  if(standalone.addEventListener)standalone.addEventListener('change',updateInstalled);
  button.onclick=async()=>{
    if(windows&&installed()){showGuide();return;}
    if(promptEvent){const event=promptEvent;promptEvent=null;button.disabled=true;
      try{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted'){help.textContent='Installation acceptée.';if(windows)pinWindows();}else help.textContent='Installation annulée. Tu peux continuer à utiliser le site.';}
      catch(_){showGuide();}
      finally{if(!installed()||windows)button.disabled=false;}
      return;
    }
    showGuide();
  };
  updateInstalled();
  if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(error=>console.error('Installation Balèti : service worker indisponible',error));
})();
