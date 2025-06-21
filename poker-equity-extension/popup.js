document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggle');
  const autoplayToggleBtn = document.getElementById('autoplay-toggle');
  const statusDiv = document.getElementById('status');
  const autoplayStatusDiv = document.getElementById('autoplay-status');
  
  // Load current status
  chrome.storage.local.get(['equityEnabled', 'autoPlayEnabled'], function(result) {
    const equityEnabled = result.equityEnabled !== false;
    const autoPlayEnabled = result.autoPlayEnabled === true;
    updateStatus(equityEnabled);
    updateAutoPlayStatus(autoPlayEnabled);
  });
  
  toggleBtn.addEventListener('click', function() {
    chrome.storage.local.get(['equityEnabled'], function(result) {
      const currentState = result.equityEnabled !== false;
      const newState = !currentState;
      
      chrome.storage.local.set({equityEnabled: newState}, function() {
        updateStatus(newState);
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleEquity',
            enabled: newState
          });
        });
      });
    });
  });
  
  autoplayToggleBtn.addEventListener('click', function() {
    chrome.storage.local.get(['autoPlayEnabled'], function(result) {
      const currentState = result.autoPlayEnabled === true;
      const newState = !currentState;
      
      chrome.storage.local.set({autoPlayEnabled: newState}, function() {
        updateAutoPlayStatus(newState);
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleAutoPlay',
            enabled: newState
          });
        });
      });
    });
  });
  
  function updateStatus(enabled) {
    if (enabled) {
      statusDiv.textContent = 'Calculator: Active';
      statusDiv.classList.add('active');
    } else {
      statusDiv.textContent = 'Calculator: Disabled';
      statusDiv.classList.remove('active');
    }
  }
  
  function updateAutoPlayStatus(enabled) {
    if (enabled) {
      autoplayStatusDiv.textContent = 'Auto-play: ENABLED ⚠️';
      autoplayStatusDiv.classList.add('active');
      autoplayStatusDiv.style.backgroundColor = '#ff9800';
      autoplayStatusDiv.style.color = 'white';
    } else {
      autoplayStatusDiv.textContent = 'Auto-play: Disabled';
      autoplayStatusDiv.classList.remove('active');
      autoplayStatusDiv.style.backgroundColor = '#f0f0f0';
      autoplayStatusDiv.style.color = '#666';
    }
  }
});