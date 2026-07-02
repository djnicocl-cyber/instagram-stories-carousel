// content.js v3 - Carrusel automatico + panel de historias

let carouselActive = false;
let storyTimer = null;
let loopCheckTimer = null;
let currentConfig = { username: '', maxAge: 24 };
let isLooping = false;

// ---- Mensajes desde popup ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCarousel') {
    currentConfig = { username: msg.username, maxAge: msg.maxAge };
    startCarousel();
    sendResponse({ ok: true });
  } else if (msg.action === 'stopCarousel') {
    stopCarousel();
    sendResponse({ ok: true });
  } else if (msg.action === 'ping') {
    sendResponse({ active: carouselActive });
  } else if (msg.action === 'getStories') {
    // Leer el DOM de Instagram para obtener la lista de historias disponibles
    const stories = extractStoriesFromDOM();
    sendResponse({ stories });
  }
  return true;
});

// ---- Extraer historias del DOM de Instagram ----
function extractStoriesFromDOM() {
  const stories = [];
  try {
    // Intentar leer la URL actual para obtener el usuario
    const pathMatch = location.pathname.match(/\/stories\/([^/]+)/);
    const currentUser = pathMatch ? pathMatch[1] : '';

    // Buscar avatar del usuario actual
    const avatarEl = document.querySelector('img[alt*="foto de perfil"], img[alt*="profile picture"], header img');
    const avatarSrc = avatarEl ? avatarEl.src : '';

    // Buscar barra de progreso para contar historias
    const segments = document.querySelectorAll(
      '[class*="ProgressBar"] > div, [class*="progressBar"] > div, [class*="Progress"] > span'
    );
    const totalSegments = segments.length || 1;

    // Calcular tiempo aproximado
    const now = new Date();
    const timeStr = 'Ahora';

    if (currentUser) {
      stories.push({
        username: currentUser,
        avatar: avatarSrc,
        time: totalSegments > 1 ? totalSegments + ' historias' : 'Historia activa',
        segments: totalSegments
      });
    }

    // Buscar otros usuarios con historias en el feed lateral si los hay
    const sideUsers = document.querySelectorAll('a[href*="/stories/"]');
    const seen = new Set([currentUser]);
    sideUsers.forEach(a => {
      const m = a.href.match(/\/stories\/([^/]+)/);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        const img = a.querySelector('img');
        stories.push({
          username: m[1],
          avatar: img ? img.src : '',
          time: 'Historia disponible'
        });
      }
    });

  } catch (e) {
    // Si falla, devolver array vacio para que popup use fallback
  }
  return stories;
}

// Auto-inicio si ya estaba activo
chrome.storage.local.get(['username', 'maxAge', 'isRunning'], (data) => {
  if (data.isRunning && data.username) {
    currentConfig = { username: data.username, maxAge: data.maxAge || 24 };
    setTimeout(startCarousel, 1800);
  }
});

// ---- Control principal ----
function startCarousel() {
  carouselActive = true;
  isLooping = false;
  clearTimers();
  waitForFirstStory();
}

function stopCarousel() {
  carouselActive = false;
  isLooping = false;
  clearTimers();
}

function clearTimers() {
  if (storyTimer) { clearTimeout(storyTimer); storyTimer = null; }
  if (loopCheckTimer) { clearTimeout(loopCheckTimer); loopCheckTimer = null; }
}

function waitForFirstStory() {
  if (!carouselActive) return;
  const video = getActiveVideo();
  if (video) {
    scheduleNextCheck();
  } else {
    storyTimer = setTimeout(waitForFirstStory, 800);
  }
}

function getActiveVideo() {
  const videos = document.querySelectorAll('video');
  for (const v of videos) {
    if (v.readyState >= 2 || v.duration > 0) return v;
  }
  return null;
}

function scheduleNextCheck() {
  if (!carouselActive) return;
  clearTimers();
  const video = getActiveVideo();
  let delay = 5000;
  if (video && video.duration > 0 && !isNaN(video.duration)) {
    const remaining = (video.duration - video.currentTime) * 1000;
    delay = Math.max(remaining, 400) + 400;
  }
  storyTimer = setTimeout(handleStoryEnd, delay);
}

function handleStoryEnd() {
  if (!carouselActive) return;
  const nextBtn = document.querySelector(
    '[aria-label="Next"], [aria-label="Siguiente"], [aria-label="Next story"], [aria-label="Siguiente historia"]'
  );
  if (nextBtn) {
    nextBtn.click();
    storyTimer = setTimeout(scheduleNextCheck, 1200);
  } else {
    startLoop();
  }
}

// ---- BUCLE: volver al inicio SIN recargar pagina ----
function startLoop() {
  if (!carouselActive || isLooping) return;
  isLooping = true;
  const segments = document.querySelectorAll(
    '[class*="ProgressSegment"], [class*="progressSegment"], div[role="progressbar"]'
  );
  const count = segments.length || 5;
  pressArrowLeftMany(count + 2);
}

function pressArrowLeftMany(times) {
  if (!carouselActive) return;
  if (times <= 0) {
    isLooping = false;
    storyTimer = setTimeout(scheduleNextCheck, 1500);
    return;
  }
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowLeft', keyCode: 37, code: 'ArrowLeft', bubbles: true, cancelable: true
  }));
  loopCheckTimer = setTimeout(() => pressArrowLeftMany(times - 1), 150);
}

// Sincronizar cuando cambia el video
const videoObserver = new MutationObserver(() => {
  if (carouselActive && !isLooping && !storyTimer) {
    scheduleNextCheck();
  }
});
videoObserver.observe(document.body, { childList: true, subtree: true });
