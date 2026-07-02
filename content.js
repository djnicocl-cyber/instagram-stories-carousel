// content.js v4 - Bucle real sin recargar pagina

let carouselActive = false;
let storyTimer = null;
let currentConfig = { username: '', maxAge: 24 };

// ---- Mensajes desde popup ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCarousel') {
    currentConfig = { username: msg.username, maxAge: msg.maxAge };
    startCarousel();
    sendResponse({ ok: true });
  } else if (msg.action === 'stopCarousel') {
    stopCarousel();
    sendResponse({ ok: true });
  } else if (msg.action === 'getStories') {
    sendResponse({ stories: extractStoriesFromDOM() });
  }
  return true;
});

// Auto-inicio si ya estaba activo
chrome.storage.local.get(['username', 'maxAge', 'isRunning'], (data) => {
  if (data.isRunning && data.username) {
    currentConfig = { username: data.username, maxAge: data.maxAge || 24 };
    setTimeout(startCarousel, 1800);
  }
});

function startCarousel() {
  carouselActive = true;
  clearTimer();
  waitForStory();
}

function stopCarousel() {
  carouselActive = false;
  clearTimer();
}

function clearTimer() {
  if (storyTimer) { clearTimeout(storyTimer); storyTimer = null; }
}

// Esperar a que aparezca video o imagen de historia
function waitForStory() {
  if (!carouselActive) return;
  if (getActiveVideo()) {
    scheduleAdvance();
  } else {
    storyTimer = setTimeout(waitForStory, 700);
  }
}

function getActiveVideo() {
  const vids = document.querySelectorAll('video');
  for (const v of vids) {
    if (v.readyState >= 2 || v.duration > 0) return v;
  }
  return null;
}

// Programar cuando avanzar a la siguiente historia
function scheduleAdvance() {
  if (!carouselActive) return;
  clearTimer();
  const video = getActiveVideo();
  let delay = 5000; // default para imagenes
  if (video && video.duration > 0 && !isNaN(video.duration)) {
    const rem = (video.duration - video.currentTime) * 1000;
    delay = Math.max(rem, 300) + 500;
  }
  storyTimer = setTimeout(tryAdvance, delay);
}

// Intentar avanzar. Si no hay siguiente -> reiniciar bucle
function tryAdvance() {
  if (!carouselActive) return;

  const next = getNextButton();
  if (next) {
    next.click();
    storyTimer = setTimeout(scheduleAdvance, 1000);
  } else {
    // No hay boton siguiente: llegamos al final
    loopBack();
  }
}

function getNextButton() {
  // Varios selectores posibles segun version de Instagram
  const selectors = [
    'button[aria-label="Next"]',
    'button[aria-label="Siguiente"]',
    'button[aria-label="Next story"]',
    'button[aria-label="Siguiente historia"]',
    'div[role="button"][aria-label*="Next"]',
    'div[role="button"][aria-label*="Siguiente"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  // Alternativa: area clickeable derecha de la pantalla
  // Instagram tiene zonas invisibles a los costados
  return null;
}

// ---- BUCLE: volver a primera historia del usuario ----
// Estrategia: click en el avatar del usuario dentro de Instagram
// Sin recargar la pagina, usando la navegacion interna de Instagram (SPA)
function loopBack() {
  if (!carouselActive) return;
  const username = currentConfig.username;
  if (!username) return;

  // Instagram es una SPA (Single Page App)
  // Usar history.pushState + popstate fuerza navegacion interna sin recargar
  // Esto evita que Instagram muestre pantalla de login
  const targetUrl = '/stories/' + username + '/';

  try {
    // Metodo 1: Buscar link interno al usuario en la pagina actual
    const userLink = document.querySelector('a[href*="/stories/' + username + '"]');
    if (userLink) {
      userLink.click();
      storyTimer = setTimeout(waitForStory, 1500);
      return;
    }

    // Metodo 2: Usar pushState para navegar como SPA sin recargar
    // Esto funciona porque Instagram escucha cambios en history
    history.pushState({}, '', targetUrl);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    storyTimer = setTimeout(() => {
      if (carouselActive) {
        // Si despues de 2s sigue sin historias, intentar navegacion directa
        if (!getActiveVideo()) {
          navigateDirect(username);
        } else {
          waitForStory();
        }
      }
    }, 2000);

  } catch(e) {
    navigateDirect(username);
  }
}

// Navegacion directa como ultimo recurso
// Usamos fetch para pre-autenticar antes de navegar
function navigateDirect(username) {
  if (!carouselActive) return;
  // Navegar dentro del mismo dominio - Instagram mantiene la sesion
  // El truco: modificar location.pathname sin recargar usando replaceState
  // y luego disparar el router interno de React de Instagram
  const targetUrl = 'https://www.instagram.com/stories/' + username + '/';

  // Intentar con el router de React que usa Instagram internamente
  const reactRoot = document.getElementById('react-root') || document.querySelector('[data-reactroot]');
  if (reactRoot) {
    // Forzar navegacion via history API que React escucha
    window.history.pushState(null, null, '/stories/' + username + '/');
    // Disparar evento que React Router/Next.js escucha
    window.dispatchEvent(new Event('popstate'));
    storyTimer = setTimeout(waitForStory, 2500);
    return;
  }

  // Ultimo recurso: location.assign (mantiene sesion mejor que location.href)
  window.location.assign(targetUrl);
}

// ---- Extraccion de historias para el panel del popup ----
function extractStoriesFromDOM() {
  const stories = [];
  try {
    const pathMatch = location.pathname.match(/\/stories\/([^/]+)/);
    const currentUser = pathMatch ? pathMatch[1] : '';
    const avatarEl = document.querySelector('img[alt*="foto de perfil"], img[alt*="profile picture"], header img');
    const segments = document.querySelectorAll('[class*="ProgressBar"] > div, [class*="progressBar"] > div');
    if (currentUser) {
      stories.push({
        username: currentUser,
        avatar: avatarEl ? avatarEl.src : '',
        time: segments.length > 1 ? segments.length + ' historias' : 'Historia activa'
      });
    }
    const sideUsers = document.querySelectorAll('a[href*="/stories/"]');
    const seen = new Set([currentUser]);
    sideUsers.forEach(a => {
      const m = a.href.match(/\/stories\/([^/?]+)/);
      if (m && !seen.has(m[1]) && m[1] !== 'highlights') {
        seen.add(m[1]);
        const img = a.querySelector('img');
        stories.push({ username: m[1], avatar: img ? img.src : '', time: 'Disponible' });
      }
    });
  } catch(e) {}
  return stories;
}

// Observar cambios de video para re-sincronizar timer
let lastVideoSrc = '';
setInterval(() => {
  if (!carouselActive || storyTimer) return;
  const v = getActiveVideo();
  if (v && v.src !== lastVideoSrc) {
    lastVideoSrc = v.src;
    scheduleAdvance();
  }
}, 1000);
