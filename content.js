// content.js - Carrusel automatico de Instagram Stories v2

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

// ---- Esperar que cargue la primera historia ----
function waitForFirstStory() {
  if (!carouselActive) return;
  const video = getActiveVideo();
  if (video) {
    scheduleNextCheck();
  } else {
    storyTimer = setTimeout(waitForFirstStory, 800);
  }
}

// ---- Obtener video activo ----
function getActiveVideo() {
  // Buscar video que este reproduciendo o cargado
  const videos = document.querySelectorAll('video');
  for (const v of videos) {
    if (v.readyState >= 2 || v.duration > 0) return v;
  }
  return null;
}

// ---- Programar la siguiente verificacion ----
function scheduleNextCheck() {
  if (!carouselActive) return;
  const video = getActiveVideo();
  let delay = 5000; // default para imagenes
  if (video && video.duration > 0 && !isNaN(video.duration)) {
    const remaining = (video.duration - video.currentTime) * 1000;
    delay = Math.max(remaining, 500) + 400;
  }
  storyTimer = setTimeout(handleStoryEnd, delay);
}

// ---- Cuando termina una historia ----
function handleStoryEnd() {
  if (!carouselActive) return;

  // Verificar si hay boton Siguiente visible
  const nextBtn = document.querySelector(
    '[aria-label="Next"], [aria-label="Siguiente"], [aria-label="Next story"], [aria-label="Siguiente historia"]'
  );

  if (nextBtn) {
    nextBtn.click();
    storyTimer = setTimeout(scheduleNextCheck, 1200);
  } else {
    // Llegamos al final - iniciar bucle SIN recargar pagina
    startLoop();
  }
}

// ---- BUCLE: volver a la primera historia sin recargar ----
function startLoop() {
  if (!carouselActive || isLooping) return;
  isLooping = true;

  // Usar tecla ArrowLeft repetidas veces para volver al inicio
  // Instagram responde a las flechas del teclado para navegar
  goToFirstStory();
}

function goToFirstStory() {
  if (!carouselActive) return;

  // Contar cuantas historias hay en la barra de progreso
  const segments = document.querySelectorAll(
    '[class*="ProgressSegment"], [class*="progressSegment"], div[style*="transition"] div[style*="transform"]'
  );

  // Intentar con el boton de retroceso o con tecla ArrowLeft
  const prevBtn = document.querySelector(
    '[aria-label="Previous"], [aria-label="Anterior"], [aria-label="Back"], [aria-label="Previous story"]'
  );

  if (segments.length > 1) {
    // Presionar ArrowLeft tantas veces como historias haya para volver al inicio
    pressArrowLeftMany(segments.length + 2);
  } else {
    // Metodo alternativo: click en el lado izquierdo de la pantalla
    clickLeftSide();
  }
}

function pressArrowLeftMany(times) {
  if (!carouselActive) return;
  if (times <= 0) {
    isLooping = false;
    storyTimer = setTimeout(scheduleNextCheck, 1500);
    return;
  }
  // Disparar evento de teclado ArrowLeft en el documento
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowLeft', keyCode: 37, code: 'ArrowLeft', bubbles: true, cancelable: true
  }));
  loopCheckTimer = setTimeout(() => pressArrowLeftMany(times - 1), 120);
}

function clickLeftSide() {
  if (!carouselActive) return;
  // Hacer click en el cuarto izquierdo de la pantalla (zona de retroceso de Instagram)
  const x = Math.floor(window.innerWidth * 0.15);
  const y = Math.floor(window.innerHeight * 0.5);
  const el = document.elementFromPoint(x, y);
  if (el) {
    el.click();
    loopCheckTimer = setTimeout(() => {
      isLooping = false;
      storyTimer = setTimeout(scheduleNextCheck, 1200);
    }, 500);
  } else {
    isLooping = false;
    storyTimer = setTimeout(scheduleNextCheck, 1000);
  }
}

// ---- Observar cambios de video para sincronizar ----
const videoObserver = new MutationObserver(() => {
  if (carouselActive && !isLooping && !storyTimer) {
    scheduleNextCheck();
  }
});
videoObserver.observe(document.body, { childList: true, subtree: true });
