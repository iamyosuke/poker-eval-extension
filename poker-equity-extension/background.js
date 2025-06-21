chrome.runtime.onInstalled.addListener(() => {
  console.log('Poker Equity Calculator extension installed');
  
  // Set default storage values
  chrome.storage.local.set({
    equityEnabled: false,
    autoPlayEnabled: false
  });
});