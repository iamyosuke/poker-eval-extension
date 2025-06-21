chrome.runtime.onInstalled.addListener(() => {
  console.log('Poker Equity Calculator extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});