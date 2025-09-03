chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('https://axiom.trade/meme/')) {
    chrome.sidePanel.open({ tabId });
    // Notify content script of page load
    chrome.tabs.sendMessage(tabId, { action: 'scrapeTokenAddress' });
  }
});

// Listen for navigation changes
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.url.includes('https://axiom.trade/meme/')) {
    chrome.tabs.sendMessage(details.tabId, { action: 'scrapeTokenAddress' });
  }
});