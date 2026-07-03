// background.js v4 - Inyeccion directa via scripting API + deteccion via tabs.onUpdated
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'START_LOOP') {
    const tabId = msg.tabId || sender.tab?.id;
    const username = msg.username;
    chrome.storage.local.set({ loopActive: true, targetUser: username, monitoredTabId: tabId });
    if (tabId) injectLoopScript(tabId, username);
    sendResponse({ ok: true });
  }

  if (msg.type === 'STOP_LOOP') {
    chrome.storage.local.get(['monitoredTabId'], (data) => {
      if (data.monitoredTabId) {
        chrome.scripting.executeScript({
          target: { tabId: data.monitoredTabId },
          func: () => {
            window._storyLoopActive = false;
            if (window._storyLoopInterval) clearInterval(window._storyLoopInterval);
          }
        }).catch(() => {});
      }
    });
    chrome.storage.local.set({ loopActive: false, targetUser: null, monitoredTabId: null });
    sendResponse({ ok: true });
  }

  if (msg.type === 'GET_STATE') {
    chrome.storage.local.get(['loopActive', 'targetUser'], (data) => {
      sendResponse({ loopActive: !!data.loopActive, targetUser: data.targetUser });
    });
    return true;
  }

  return true;
});

function injectLoopScript(tabId, username) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (user) => {
      if (window._storyLoopActive) return;
      window._storyLoopActive = true;

      console.log('[StoryLoop] Iniciado para:', user);

      function autoClick() {
        const btns = document.querySelectorAll('div[role="button"], button');
        for (const btn of btns) {
          const txt = btn.textContent.trim();
          if (txt === 'Ver historia' || txt === 'Watch story' || txt === 'View story' ||
              /^Ver (como|historia)/i.test(txt)) {
            btn.click();
            return true;
          }
        }
        return false;
      }

      function goBackToStart() {
        let i = 0;
        const t = setInterval(() => {
          if (i >= 25 || !window._storyLoopActive) { clearInterval(t); return; }
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37,
            bubbles: true, cancelable: true
          }));
          i++;
        }, 120);
      }

      const _push = history.pushState.bind(history);
      const _replace = history.replaceState.bind(history);
      let _redirecting = false;

      history.pushState = function(s, t, url) {
        if (window._storyLoopActive && url && !/\/stories\//i.test(String(url)) && !_redirecting) {
          console.log('[StoryLoop] pushState interceptado - volviendo al inicio');
          _redirecting = true;
          setTimeout(() => { goBackToStart(); setTimeout(() => { _redirecting = false; }, 3500); }, 50);
          return;
        }
        return _push(s, t, url);
      };

      history.replaceState = function(s, t, url) {
        if (window._storyLoopActive && url && !/\/stories\//i.test(String(url)) && !_redirecting) {
          console.log('[StoryLoop] replaceState interceptado - volviendo al inicio');
          _redirecting = true;
          setTimeout(() => { goBackToStart(); setTimeout(() => { _redirecting = false; }, 3500); }, 50);
          return;
        }
        return _replace(s, t, url);
      };

      window._storyLoopInterval = setInterval(() => {
        if (!window._storyLoopActive) return;
        autoClick();
        if (!location.href.includes('/stories/') && !_redirecting) {
          console.log('[StoryLoop] Fallback - fuera de stories');
          _redirecting = true;
          goBackToStart();
          setTimeout(() => { _redirecting = false; }, 3500);
        }
      }, 500);

      console.log('[StoryLoop] Listo. pushState parcheado:', !history.pushState.toString().includes('[native code]'));
    },
    args: [username]
  }).catch(err => console.error('[StoryLoop] Error:', err));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;
    if (!(tab.url || '').includes('instagram.com')) return;
    console.log('[BG] Tab recargada, re-inyectando. URL:', tab.url);
    injectLoopScript(tabId, data.targetUser);
  });
});
