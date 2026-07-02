// background.js - Service Worker v2
// Usa chrome.storage para persistir estado (service workers se duermen)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_LOOP') {
    const tabId = msg.tabId || sender.tab?.id;
    chrome.storage.local.set({
      loopActive: true,
      targetUser: msg.username,
      monitoredTabId: tabId
    });
    // Enviar mensaje al content script para que empiece a monitorear
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'START_MONITORING' });
    }
    sendResponse({ ok: true });
  }

  if (msg.type === 'STOP_LOOP') {
    chrome.storage.local.get(['monitoredTabId'], (data) => {
      if (data.monitoredTabId) {
        chrome.tabs.sendMessage(data.monitoredTabId, { type: 'STOP_MONITORING' }).catch(() => {});
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

  // Content script detectó que las historias terminaron
  if (msg.type === 'STORIES_ENDED') {
    chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
      if (!data.loopActive || !data.targetUser) return;
      const tabId = data.monitoredTabId || sender.tab?.id;
      if (!tabId) return;
      const targetUrl = 'https://www.instagram.com/stories/' + data.targetUser + '/';
      setTimeout(() => {
        chrome.tabs.update(tabId, { url: targetUrl });
      }, 400);
    });
    sendResponse({ ok: true });
  }

  return true;
});

// Tambien detectar via tabs.onUpdated como backup
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;

  chrome.storage.local.get(['loopActive', 'targetUser', 'monitoredTabId'], (data) => {
    if (!data.loopActive || !data.targetUser) return;
    if (tabId !== data.monitoredTabId) return;

    const url = changeInfo.url || tab.url || '';
    if (!url || !url.includes('instagram.com')) return;

    const inStories = new RegExp('/stories/' + data.targetUser, 'i').test(url);
    if (!inStories) {
      setTimeout(() => {
        chrome.storage.local.get(['loopActive'], (d) => {
          if (!d.loopActive) return;
          chrome.tabs.update(tabId, {
            url: 'https://www.instagram.com/stories/' + data.targetUser + '/'
          });
        });
      }, 600);
    }
  });
});
