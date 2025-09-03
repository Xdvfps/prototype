document.addEventListener('DOMContentLoaded', () => {
  const chatWindow = document.getElementById('chat-window');
  const inputForm = document.getElementById('input-form');
  const userInput = document.getElementById('user-input');
  const clearButton = document.getElementById('clear-button');

  // Replace with your n8n webhook URL
  const webhookUrl = 'https://n8n-service-jo3m.onrender.com/webhook/extchrome';

  // Add basic auth if needed (uncomment and replace user:password)
  // const authHeader = 'Basic ' + btoa('user:password');

  // Clear chat window on initial load
  chatWindow.innerHTML = '';

  // Function to create a clickable link from a URL
  function createClickableLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      // Ensure the URL has a protocol
      const fullUrl = url.startsWith('http') ? url : `http://${url}`;
      return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
  }

  // Add message to chat window
  function addMessageToChat(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    const senderLabel = sender === 'user' ? 'User' : 'Jarvis';
    
    // Apply the link conversion to the message text
    const formattedText = createClickableLinks(text);

    messageDiv.innerHTML = `<strong>${senderLabel}:</strong><br>${formattedText}`;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Load initial chat history
  chrome.storage.local.get(['chatHistory'], (result) => {
    if (result.chatHistory) {
      result.chatHistory.forEach(message => {
        addMessageToChat(message.text, message.sender);
      });
    }
  });

  // Listen for storage changes (e.g., from content.js)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.chatHistory) {
      const newHistory = changes.chatHistory.newValue || [];
      const existingMessages = Array.from(chatWindow.querySelectorAll('.message')).map(div => div.innerHTML);

      newHistory.forEach(message => {
        const messageText = `<strong>${message.sender === 'user' ? 'User' : 'Jarvis'}:</strong><br>${createClickableLinks(message.text)}`;
        if (!existingMessages.some(html => html.includes(messageText))) {
          addMessageToChat(message.text, message.sender);
        }
      });
    }
  });

  // Send message to n8n webhook
  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Display user message
    addMessageToChat(message, 'user');
    userInput.value = '';

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

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      const botReply = data.output || 'No response from AI';
      addMessageToChat(botReply, 'bot');

      // Save to chat history
      chrome.storage.local.get(['chatHistory'], (result) => {
        const chatHistory = result.chatHistory || [];
        if (!chatHistory.some(msg => msg.text === message && msg.sender === 'user')) {
          chatHistory.push({ text: message, sender: 'user' });
          chatHistory.push({ text: botReply, sender: 'bot' });
          chrome.storage.local.set({ chatHistory });
        }
      });
    } catch (error) {
      addMessageToChat('Error: Could not connect to AI', 'bot');
      console.error('Error sending message to webhook:', error.message);
    }
  }

  // Clear chat history
  function clearChat() {
    chatWindow.innerHTML = '';
    chrome.storage.local.set({ chatHistory: [] });
  }

  // Event listeners
  inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  clearButton.addEventListener('click', clearChat);
});