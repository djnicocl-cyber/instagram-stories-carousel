// content.js - Instagram Stories Carousel Extension
// El BUCLE lo maneja background.js via chrome.tabs.update.

(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STORIES') {
      sendResponse({ stories: getStoriesList() });
    }
    return true;
  });

  function getStoriesList() {
    const results = [];
    try {
      const items = document.querySelectorAll('div[role="button"] canvas, button[aria-label] img[alt]');
      items.forEach(el => {
        const img = el.tagName === 'IMG' ? el : el.closest('button, div[role="button"]')?.querySelector('img');
        if (img) results.push({ name: img.alt || '', thumb: img.src || '' });
      });
      if (!results.length) {
        document.querySelectorAll('header img').forEach(img => {
          if (img.src) results.push({ name: img.alt || '', thumb: img.src });
        });
      }
    } catch(e) {}
    return results;
  }
})();
