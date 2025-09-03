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
    const urlRegex = /(https?:\/\/[^\s()]+|\bwww\.[^\s()]+)/g;
    return text.replace(urlRegex, (url) => {
      // Ensure the URL has a protocol
      const fullUrl = url.startsWith('http') ? url : `http://${url}`;
      return `<a href="${fullUrl}" target="_blank">${url}</a>`;
    });
  }

  // Add message to chat window with enhanced formatting
  function addMessageToChat(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    const senderLabel = sender === 'user' ? 'User' : 'Tony';

    let formattedContent = '';
    const lines = text.split('\n');
    lines.forEach(line => {
      // Check if the line contains a colon to bold the key
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        formattedContent += `<strong>${key}:</strong>${value}<br>`;
      } else {
        formattedContent += `${line}<br>`;
      }
    });

    // Apply the link conversion to the formatted text
    const finalFormattedText = createClickableLinks(formattedContent);

    messageDiv.innerHTML = `<strong>${senderLabel}:</strong><br>${finalFormattedText}`;
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

  // Listen for storage changes from other parts of the extension (like content.js)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.chatHistory) {
      const newHistory = changes.chatHistory.newValue || [];
      const currentMessages = Array.from(chatWindow.querySelectorAll('.message'));
      const lastMessage = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : null;

      // Find the index of the last displayed message in the new history
      let lastIndex = -1;
      if (lastMessage) {
        const lastSender = lastMessage.classList.contains('user-message') ? 'user' : 'bot';
        // A simple text match is more reliable than an HTML check
        const lastText = lastMessage.textContent.split(':').slice(1).join(':').trim();
        lastIndex = newHistory.findIndex(msg => msg.text.trim() === lastText && msg.sender === lastSender);
      }

      // Add messages from the new history that are not yet displayed
      for (let i = lastIndex + 1; i < newHistory.length; i++) {
        const message = newHistory[i];
        addMessageToChat(message.text, message.sender);
      }
    }
  });


  // Send message to n8n webhook
  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Display user message immediately
    addMessageToChat(message, 'user');
    userInput.value = '';

    // Get current history to append new messages
    chrome.storage.local.get(['chatHistory'], async (result) => {
      let chatHistory = result.chatHistory || [];
      chatHistory.push({ text: message, sender: 'user' });

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

        // Add the bot's reply to the in-memory history and the UI
        chatHistory.push({ text: botReply, sender: 'bot' });
        addMessageToChat(botReply, 'bot');

        // Save the updated history to storage
        chrome.storage.local.set({ chatHistory });

      } catch (error) {
        const errorMessage = 'Error: Could not connect to AI';
        addMessageToChat(errorMessage, 'bot');
        chatHistory.push({ text: errorMessage, sender: 'bot' });
        chrome.storage.local.set({ chatHistory });
        console.error('Error sending message to webhook:', error.message);
      }
    });
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