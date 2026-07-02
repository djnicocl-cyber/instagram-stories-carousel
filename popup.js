// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const btnLoad      = document.getElementById('btnLoad');
  const btnStart     = document.getElementById('btnStart');
  const btnStop      = document.getElementById('btnStop');
  const storiesPanel = document.getElementById('storiesPanel');
  const statusDiv    = document.getElementById('status');

  let currentUsername = '';

  // Restore saved username
  chrome.storage.local.get(['username'], (res) => {
    if (res.username) usernameInput.value = res.username;
  });

  // Restore loop state
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
    if (res && res.loopActive) {
      currentUsername = res.targetUser;
      usernameInput.value = currentUsername;
      setStatus('Bucle activo para @' + currentUsername, 'green');
      btnStop.style.display = 'inline-block';
      btnStart.style.display = 'none';
    }
  });

  btnLoad.addEventListener('click', () => {
    const username = usernameInput.value.trim().replace('@', '');
    if (!username) { setStatus('Ingresa un nombre de usuario', 'red'); return; }
    currentUsername = username;
    chrome.storage.local.set({ username });
    setStatus('Buscando historias de @' + username + '...', 'gray');
    storiesPanel.innerHTML = '';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tab = tabs[0];
      const targetUrl = 'https://www.instagram.com/stories/' + username + '/';
      if (!tab.url.includes('instagram.com')) {
        chrome.tabs.update(tab.id, { url: targetUrl });
        setStatus('Abriendo Instagram...', 'gray');
        return;
      }
      chrome.tabs.update(tab.id, { url: targetUrl }, () => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: 'GET_STORIES', username }, (response) => {
            if (chrome.runtime.lastError || !response) {
              setStatus('Listo. Presiona Iniciar para comenzar el bucle.', 'gray');
              return;
            }
            renderStories(response.stories || []);
          });
        }, 2500);
      });
    });
  });

  btnStart.addEventListener('click', () => {
    const username = usernameInput.value.trim().replace('@', '');
    if (!username) { setStatus('Ingresa un nombre de usuario', 'red'); return; }
    currentUsername = username;
    chrome.storage.local.set({ username });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;
      const targetUrl = 'https://www.instagram.com/stories/' + username + '/';
      chrome.runtime.sendMessage({ type: 'START_LOOP', username, tabId }, () => {
        chrome.tabs.update(tabId, { url: targetUrl });
        setStatus('Bucle activo para @' + username, 'green');
        btnStop.style.display = 'inline-block';
        btnStart.style.display = 'none';
      });
    });
  });

  btnStop.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_LOOP' }, () => {
      setStatus('Bucle detenido', 'gray');
      btnStop.style.display = 'none';
      btnStart.style.display = 'inline-block';
    });
  });

  function renderStories(stories) {
    if (!stories.length) {
      setStatus('No se encontraron historias activas', 'gray');
      return;
    }
    setStatus(stories.length + ' historia(s) encontrada(s)', 'green');
    stories.forEach(s => {
      const item = document.createElement('div');
      item.className = 'story-item';
      item.innerHTML = (s.thumb ? '<img src="' + s.thumb + '" />' : '') +
        '<span>' + (s.name || currentUsername) + '</span>';
      storiesPanel.appendChild(item);
    });
  }

  function setStatus(msg, color) {
    statusDiv.textContent = msg;
    statusDiv.style.color = color === 'green' ? '#22c55e' : color === 'red' ? '#ef4444' : '#888';
  }
});
