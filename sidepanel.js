document.addEventListener('DOMContentLoaded', () => {
  const chatWindow = document.getElementById('chat-window');
  const inputForm = document.getElementById('input-form'); // Get the form element
  const userInput = document.getElementById('user-input');
  const clearButton = document.getElementById('clear-button');

  // Replace with your n8n webhook URL
  const webhookUrl = 'https://n8n-service-jo3m.onrender.com/webhook/extchrome';

  // Add message to chat window
  function addMessageToChat(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = text;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Load initial chat history
  chrome.storage.local.get(['chatHistory'], (result) => {
    if (result.chatHistory) {
      result.chatHistory.forEach((message) => {
        addMessageToChat(message.text, message.sender);
      });
    }
  });

  // Listen for storage changes (e.g., from content.js)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.chatHistory) {
      const newHistory = changes.chatHistory.newValue || [];
      const existingMessages = Array.from(
        chatWindow.querySelectorAll('.message')
      ).map((div) => div.textContent);
      newHistory.forEach((message) => {
        if (!existingMessages.includes(message.text)) {
          addMessageToChat(message.text, message.sender);
        }
      });
    }
  });

  // Send message to n8n webhook
  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessageToChat(message, 'user');
    userInput.value = '';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      const botReply = data.output || 'No response from AI';
      addMessageToChat(botReply, 'bot');

      chrome.storage.local.get(['chatHistory'], (result) => {
        const chatHistory = result.chatHistory || [];
        if (
          !chatHistory.some(
            (msg) => msg.text === message && msg.sender === 'user'
          )
        ) {
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
    e.preventDefault(); // Prevent the default form submission
    sendMessage();
  });
  clearButton.addEventListener('click', clearChat);
});