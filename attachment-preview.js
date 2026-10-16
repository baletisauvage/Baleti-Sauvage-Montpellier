(() => {
  'use strict';
  const dialog=document.getElementById('attachmentPreview');
  if(!dialog)return;
  const content=document.getElementById('attachmentPreviewContent'),status=document.getElementById('attachmentPreviewStatus'),title=document.getElementById('attachmentPreviewTitle'),download=document.getElementById('attachmentPreviewDownload');
  let currentUrl=null,controller=null,sequence=0;
  const format=name=>({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',txt:'text/plain'})[String(name||'').split('.').pop().toLowerCase()]||'';
  function clear(){sequence++;if(controller)controller.abort();controller=null;const video=content.querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}content.replaceChildren();if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=null;}
  document.getElementById('attachmentPreviewClose').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{clear();download.onclick=null;});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  window.previewAttachment=async(message,onDownload)=>{
    clear();const ticket=sequence;title.textContent=message.attachment_name||'Pièce jointe';download.onclick=onDownload;
    status.textContent='Chargement de l’aperçu…';if(!dialog.open)dialog.showModal();
    const type=format(message.attachment_name);
    if(!type){status.textContent='Ce format ne peut pas être affiché dans le navigateur. Utilise « Télécharger » pour l’ouvrir dans son application.';return;}
    controller=new AbortController();
    try{
      const response=await fetch('https://baleti-sauvage.baletisauvage.workers.dev/api/messages/attachment?id='+encodeURIComponent(message.id),{credentials:'include',cache:'no-store',signal:controller.signal});
      if(response.status===401)throw Error('Session expirée. Reconnecte-toi à l’administration.');
      if(!response.ok)throw Error('Pièce jointe inaccessible.');
      const bytes=await response.arrayBuffer();if(ticket!==sequence)return;
      const head=new Uint8Array(bytes.slice(0,16)),ascii=String.fromCharCode(...head);
      if(type==='application/pdf'&&!ascii.startsWith('%PDF-'))throw Error('Le fichier ne correspond pas à un PDF.');
      if(type.startsWith('image/')&&!((type==='image/jpeg'&&head[0]===255&&head[1]===216&&head[2]===255)||(type==='image/png'&&head[0]===137&&ascii.slice(1,4)==='PNG')||(type==='image/webp'&&ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')))throw Error('Le fichier ne correspond pas à une image prise en charge.');
      if(type==='text/plain'){
        const pre=document.createElement('pre');pre.textContent=new TextDecoder().decode(bytes.slice(0,200000));content.appendChild(pre);status.textContent=bytes.byteLength>200000?'Aperçu limité aux 200 premiers ko. Télécharge le fichier pour le lire en entier.':'Document texte · aperçu privé';return;
      }
      currentUrl=URL.createObjectURL(new Blob([bytes],{type}));
      let element;
      if(type.startsWith('image/')){element=document.createElement('img');element.alt=message.attachment_name||'Pièce jointe';}
      else if(type.startsWith('video/')){element=document.createElement('video');element.controls=true;element.playsInline=true;element.preload='auto';element.setAttribute('controlsList','nodownload');element.addEventListener('loadedmetadata',()=>{if(ticket===sequence)status.textContent='Vidéo prête · appuie sur ▶ pour la lire.';});element.addEventListener('error',()=>{if(ticket===sequence)status.textContent='Cette vidéo MP4 utilise probablement un codec non pris en charge par ce navigateur. Clique sur « Télécharger » pour la regarder dans ton lecteur vidéo.';});element.addEventListener('stalled',()=>{if(ticket===sequence)status.textContent='La lecture semble bloquée. Essaie « Télécharger » pour ouvrir la vidéo dans ton lecteur.';});}
      else{element=document.createElement('iframe');element.title='Aperçu PDF : '+(message.attachment_name||'document');element.referrerPolicy='no-referrer';}
      if(!type.startsWith('video/'))element.onerror=()=>{if(ticket===sequence)status.textContent='Ce navigateur ne peut pas afficher ce fichier. Le téléchargement reste disponible.';};
      element.src=currentUrl;content.appendChild(element);
      status.textContent=type==='application/pdf'?'PDF · si l’aperçu n’est pas proposé par ton navigateur, utilise « Télécharger ».':type.startsWith('video/')?'Préparation de la vidéo… Si elle ne se lit pas, utilise « Télécharger ».':'Aperçu privé · aucun fichier enregistré sur ton appareil';
    }catch(error){if(ticket===sequence&&error.name!=='AbortError')status.textContent=error.message+' Le téléchargement reste disponible.';}
  };
})();
