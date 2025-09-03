(async () => {
  // Replace with your n8n webhook URL
  const webhookUrl = 'https://n8n-service-jo3m.onrender.com/webhook/extchrome';

  // Add basic auth if needed (uncomment and replace user:password)
  // const authHeader = 'Basic ' + btoa('user:password');

  // Flag to prevent multiple requests
  let hasSentRequest = false;

  // Function to scrape token address from the Solscan link
  function scrapeTokenAddress() {
    const solscanLink = document.querySelector('a[href*="solscan.io/account/"]');
    if (solscanLink) {
      const href = solscanLink.getAttribute('href');
      const match = href.match(/solscan\.io\/account\/([A-Za-z0-9]+)/);
      if (match) {
        console.log('Token address found:', match[1]);
        return match[1];
      }
      console.error('Failed to extract token address from href:', href);
      return null;
    }
    console.error('Solscan link not found with selector: a[href*="solscan.io/account/"]');
    return null;
  }

  // Function to send token address to webhook
  async function sendToWebhook(tokenAddress) {
    if (hasSentRequest) {
      console.log('Request already sent for this page, skipping...');
      return;
    }
    hasSentRequest = true;

    const message = `Jarvis who created this token and how much lifetime fees did it generate? ${tokenAddress}`;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Uncomment and add authHeader if basic auth is enabled
          // 'Authorization': authHeader
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      const botReply = data.output || 'No response from AI';
      console.log('Webhook response:', botReply);

      // Send only bot reply to side panel via storage
      chrome.storage.local.get(['chatHistory'], (result) => {
        const chatHistory = result.chatHistory || [];
        if (!chatHistory.some(msg => msg.text === botReply && msg.sender === 'bot')) {
          chatHistory.push({ text: botReply, sender: 'bot' });
          chrome.storage.local.set({ chatHistory });
        }
      });
    } catch (error) {
      console.error('Error sending token address to webhook:', error.message);
      hasSentRequest = false; // Allow retry on error
    }
  }

  // Function to handle scraping
  function handleScrape() {
    hasSentRequest = false; // Reset flag for new page
    const tokenAddress = scrapeTokenAddress();
    if (tokenAddress) {
      sendToWebhook(tokenAddress);
      observer.disconnect();
    } else {
      // Retry after 5 seconds if not found
      setTimeout(() => {
        if (!hasSentRequest) {
          const retryTokenAddress = scrapeTokenAddress();
          if (retryTokenAddress) {
            sendToWebhook(retryTokenAddress);
            observer.disconnect();
          }
        }
      }, 5000);
    }
  }

  // Wait for dynamic content using MutationObserver
  const observer = new MutationObserver((mutations, obs) => {
    if (hasSentRequest) {
      obs.disconnect();
      return;
    }
    const tokenAddress = scrapeTokenAddress();
    if (tokenAddress) {
      sendToWebhook(tokenAddress);
      obs.disconnect();
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Listen for messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrapeTokenAddress') {
      console.log('Received scrape request from background.js');
      handleScrape();
    }
  });

  // Initial scrape on page load
  window.addEventListener('load', handleScrape);
})();