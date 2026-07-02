// popup.js - Logica del popup de la extension

const usernameInput = document.getElementById('username');
const maxAgeSelect = document.getElementById('maxAge');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const statusDiv = document.getElementById('status');

// Cargar configuracion guardada
chrome.storage.local.get(['username', 'maxAge', 'isRunning'], (data) => {
  if (data.username) usernameInput.value = data.username;
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
    setStatus('Carrusel activo - reproduciendo en bucle', 'active');
  } else {
    setStatus('Carrusel detenido', 'inactive');
  }
}

// Boton Iniciar
btnStart.addEventListener('click', async () => {
  const username = usernameInput.value.trim().replace('@', '');
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

// Boton Detener
btnStop.addEventListener('click', async () => {
  chrome.storage.local.set({ isRunning: false });
  const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/stories/*' });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'stopCarousel' });
  });
  setRunningState(false);
});
