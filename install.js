(() => {
  'use strict';
  const button = document.getElementById('installSite');
  const help = document.getElementById('contactHelp');
  if (!button || !help) return;
  let pendingPrompt = null;
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
