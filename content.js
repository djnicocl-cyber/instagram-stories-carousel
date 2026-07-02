// content.js - Script inyectado en instagram.com/stories/*

let carouselActive = false;
let loopTimeout = null;
let currentConfig = { username: '', maxAge: 24 };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCarousel') {
    currentConfig = { username: msg.username, maxAge: msg.maxAge };
    startCarousel();
    sendResponse({ ok: true });
  } else if (msg.action === 'stopCarousel') {
    stopCarousel();
    sendResponse({ ok: true });
  }
});

chrome.storage.local.get(['username', 'maxAge', 'isRunning'], (data) => {
  if (data.isRunning && data.username) {
    currentConfig = { username: data.username, maxAge: data.maxAge || 24 };
    setTimeout(startCarousel, 1500);
  }
});

function startCarousel() {
  carouselActive = true;
  clearTimers();
  waitForStories();
}

function stopCarousel() {
  carouselActive = false;
  clearTimers();
}

function clearTimers() {
  if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
}

function waitForStories() {
  if (!carouselActive) return;
  const video = document.querySelector('video[playsinline]');
  if (video) {
    playCurrentStory();
  } else {
    loopTimeout = setTimeout(waitForStories, 1000);
  }
}

function playCurrentStory() {
  if (!carouselActive) return;
  const video = document.querySelector('video[playsinline]');
  if (video && video.duration > 0) {
    const remaining = (video.duration - video.currentTime) * 1000;
    loopTimeout = setTimeout(() => {
      if (carouselActive) tryAdvance();
    }, Math.max(remaining, 500) + 300);
  } else {
    loopTimeout = setTimeout(() => {
      if (carouselActive) tryAdvance();
    }, 5000);
  }
}

function tryAdvance() {
  if (!carouselActive) return;
  const nextBtn = document.querySelector('[aria-label="Next"], [aria-label="Siguiente"]');
  if (nextBtn) {
    nextBtn.click();
    loopTimeout = setTimeout(() => {
      if (carouselActive) playCurrentStory();
    }, 1000);
  } else {
    goToStart();
  }
}

function goToStart() {
  if (!carouselActive) return;
  const username = currentConfig.username;
  if (username) {
    window.location.href = 'https://www.instagram.com/stories/' + username + '/';
  }
}

let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (carouselActive) {
      const username = currentConfig.username;
      if (username && !location.href.includes('/stories/' + username)) {
        setTimeout(() => {
          if (carouselActive) {
            window.location.href = 'https://www.instagram.com/stories/' + username + '/';
          }
        }, 500);
      } else {
        clearTimers();
        loopTimeout = setTimeout(playCurrentStory, 1000);
      }
    }
  }
});

observer.observe(document, { subtree: true, childList: true });
