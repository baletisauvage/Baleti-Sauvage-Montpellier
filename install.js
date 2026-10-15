(() => {
  'use strict';
  const button = document.getElementById('installSite');
  const help = document.getElementById('contactHelp');
  if (!button || !help) return;
  let pendingPrompt = null;
  const firefox = /Firefox\//.test(navigator.userAgent);
  const desktop = !/Android|iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (firefox && desktop) button.textContent = '📲 AJOUTER BALÈTI';
  const showDesktopShortcut = () => {
    if (document.getElementById('baletiDesktopShortcut')) return;
    const box = document.createElement('div');
    box.id = 'baletiDesktopShortcut';
    box.style.cssText = 'margin-top:16px;padding:12px;border:1px solid currentColor';
    const link = document.createElement('a');
    link.href = new URL('./', document.baseURI).href;
    link.draggable = true;
    link.title = 'Glisser ce lien sur le bureau pour créer le raccourci Balèti';
    link.style.cssText = 'display:inline-flex;align-items:center;gap:12px;color:inherit;font-weight:800;text-decoration:underline';
    const icon = document.createElement('img');
    icon.src = new URL('favicon_baleti_original.ico', document.baseURI).href;
    icon.alt = '';
    icon.draggable = false;
    icon.style.pointerEvents = 'none';
    icon.width = 56;
    icon.height = 56;
    link.appendChild(icon);
    link.appendChild(document.createTextNode('Balèti Sauvage Montpellier'));
    const note = document.createElement('p');
    note.textContent = 'Pour créer un raccourci sur le bureau : réduis la fenêtre de Firefox, puis fais glisser cette icône vers une zone libre du bureau.';
    note.style.cssText = 'font-size:14px;line-height:1.5;margin:12px 0 0';
    box.appendChild(link);
    box.appendChild(note);
    help.parentNode.insertBefore(box, help.nextSibling);
  };
  const standalone = window.matchMedia('(display-mode: standalone)');
  const installed = () => standalone.matches || navigator.standalone === true;
  const showInstalled = () => {
    if (!installed()) return;
    button.textContent = '✓ BALÈTI EST INSTALLÉ';
    button.disabled = true;
    help.textContent = 'Tu ouvres déjà Balèti depuis son icône.';
  };
  help.setAttribute('role', 'status');
  help.setAttribute('aria-live', 'polite');
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingPrompt = event;
    button.disabled = false;
    button.textContent = '📲 INSTALLER BALÈTI';
  });
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    button.textContent = '✓ BALÈTI EST INSTALLÉ';
    button.disabled = true;
    help.textContent = 'Balèti est installé. Retrouve son icône sur ton appareil.';
  });
  if (standalone.addEventListener) standalone.addEventListener('change', showInstalled);
  button.onclick = async () => {
    if (installed()) { showInstalled(); return; }
    if (pendingPrompt) {
      const prompt = pendingPrompt;
      pendingPrompt = null;
      button.disabled = true;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        help.textContent = choice.outcome === 'accepted'
          ? 'Installation acceptée. Ton appareil prépare l’icône Balèti.'
          : 'Installation annulée. Tu peux continuer à utiliser le site.';
      } catch (_) {
        help.textContent = 'Ouvre le menu de ton navigateur et choisis « Installer l’application » si cette option est proposée.';
      } finally { if (!installed()) button.disabled = false; }
      return;
    }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) {
      help.textContent = 'Sur iPhone ou iPad : ouvre le menu Partager, choisis « Sur l’écran d’accueil », puis confirme avec « Ajouter ». L’icône Balèti ouvrira directement le site.';
    } else if (firefox && desktop) {
      help.textContent = /Win/.test(navigator.platform)
        ? 'Firefox sous Windows : clique sur le bouton « Applications web » dans la barre d’adresse pour installer Balèti et l’ajouter à la barre des tâches. Si ce bouton n’est pas proposé, crée le raccourci bureau avec l’icône ci-dessous.'
        : 'Dans Firefox, crée un raccourci en faisant glisser le lien Balèti ci-dessous sur le bureau.';
      showDesktopShortcut();
    } else if (/Mac/.test(navigator.platform) && /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent)) {
      help.textContent = 'Dans Safari sur Mac : choisis Fichier → Ajouter au Dock, puis confirme. L’icône Balèti ouvrira le site dans sa propre fenêtre.';
    } else {
      help.textContent = 'Si aucune fenêtre d’installation ne s’ouvre, ouvre le menu de ton navigateur et choisis « Installer l’application » ou « Ajouter à l’écran d’accueil » si proposé. Tu peux aussi ouvrir ce site dans Chrome ou Edge.';
    }
  };
  showInstalled();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'})
      .catch(error => console.error('Installation Balèti : service worker indisponible', error));
  }
})();
