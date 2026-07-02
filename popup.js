// popup.js v2 - con panel de historias y bucle sin interrupciones

const usernameInput = document.getElementById('username');
const maxAgeSelect = document.getElementById('maxAge');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnLoad = document.getElementById('btnLoad');
const statusDiv = document.getElementById('status');
const storiesPanel = document.getElementById('storiesPanel');
const storiesList = document.getElementById('storiesList');
const storiesLoading = document.getElementById('storiesLoading');
const storiesEmpty = document.getElementById('storiesEmpty');

let selectedUsername = '';

// Cargar config guardada
chrome.storage.local.get(['username', 'maxAge', 'isRunning'], (data) => {
  if (data.username) { usernameInput.value = data.username; selectedUsername = data.username; }
  if (data.maxAge) maxAgeSelect.value = data.maxAge;
  if (data.isRunning) setRunningState(true);
});

function setStatus(msg, type) {
  statusDiv.textContent = msg;
  statusDiv.className = 'status ' + type;
}

function setRunningState(running) {
  btnStart.disabled = running;
  btnStop.disabled = !running;
  if (running) {
    setStatus('Carrusel activo - bucle automatico activado', 'active');
  } else {
    setStatus('Carrusel detenido', 'inactive');
  }
}

// ---- Boton: Ver historias disponibles ----
btnLoad.addEventListener('click', async () => {
  const username = usernameInput.value.trim().replace('@', '');
  if (!username) {
    setStatus('Ingresa un nombre de usuario primero', 'inactive');
    usernameInput.focus();
    return;
  }

  setStatus('Buscando historias...', 'loading');
  storiesPanel.classList.add('visible');
  storiesLoading.style.display = 'block';
  storiesEmpty.style.display = 'none';
  // Limpiar lista anterior (excepto los elementos de control)
  const items = storiesList.querySelectorAll('.story-item');
  items.forEach(i => i.remove());

  // Abrir tab de Instagram Stories para obtener la lista
  const url = 'https://www.instagram.com/stories/' + username + '/';
  const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/stories/*' });

  let tabId;
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { url, active: false });
    tabId = tabs[0].id;
  } else {
    const t = await chrome.tabs.create({ url, active: false });
    tabId = t.id;
  }

  // Esperar que cargue y pedir datos al content script
  setTimeout(() => fetchStoriesFromTab(tabId, username), 3000);
});

async function fetchStoriesFromTab(tabId, username) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'getStories' });
    storiesLoading.style.display = 'none';
    if (response && response.stories && response.stories.length > 0) {
      renderStories(response.stories, username);
      setStatus(response.stories.length + ' historias encontradas', 'active');
    } else {
      storiesEmpty.style.display = 'block';
      setStatus('No se encontraron historias', 'inactive');
    }
  } catch (e) {
    storiesLoading.style.display = 'none';
    // Mostrar usuario directamente aunque no se pueda leer el DOM
    renderStories([{ username: username, time: 'Recientes', avatar: '' }], username);
    setStatus('Usuario listo para reproducir', 'active');
  }
}

function renderStories(stories, defaultUser) {
  const items = storiesList.querySelectorAll('.story-item');
  items.forEach(i => i.remove());

  stories.forEach((story, idx) => {
    const item = document.createElement('div');
    item.className = 'story-item' + (idx === 0 ? ' selected' : '');
    item.dataset.username = story.username || defaultUser;

    const avatarHtml = story.avatar
      ? '<img class="story-thumb" src="' + story.avatar + '" onerror="this.style.display=none">'
      : '<div class="story-thumb-placeholder">' + (story.username || defaultUser)[0].toUpperCase() + '</div>';

    item.innerHTML = avatarHtml +
      '<div class="story-info">' +
        '<div class="story-user">@' + (story.username || defaultUser) + '</div>' +
        '<div class="story-time">' + (story.time || 'Historia activa') + '</div>' +
      '</div>' +
      '<div class="story-check"></div>';

    item.addEventListener('click', () => {
      document.querySelectorAll('.story-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      selectedUsername = item.dataset.username;
      usernameInput.value = selectedUsername;
    });

    storiesList.appendChild(item);
  });

  // Seleccionar el primero por defecto
  if (stories.length > 0) {
    selectedUsername = stories[0].username || defaultUser;
  }
}

// ---- Boton Iniciar ----
btnStart.addEventListener('click', async () => {
  const username = (selectedUsername || usernameInput.value.trim()).replace('@', '');
  if (!username) {
    setStatus('Ingresa un nombre de usuario', 'inactive');
    usernameInput.focus();
    return;
  }

  const maxAge = parseInt(maxAgeSelect.value, 10);
  chrome.storage.local.set({ username, maxAge, isRunning: true });

  const url = 'https://www.instagram.com/stories/' + username + '/';
  const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/stories/*' });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { url, active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
    setTimeout(() => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'startCarousel', username, maxAge });
    }, 2000);
  } else {
    const newTab = await chrome.tabs.create({ url });
    setTimeout(() => {
      chrome.tabs.sendMessage(newTab.id, { action: 'startCarousel', username, maxAge });
    }, 3000);
  }

  setRunningState(true);
});

// ---- Boton Detener ----
btnStop.addEventListener('click', async () => {
  chrome.storage.local.set({ isRunning: false });
  const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/stories/*' });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'stopCarousel' });
  });
  setRunningState(false);
});
