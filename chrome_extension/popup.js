
document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('token');
  const statusDiv = document.getElementById('status');

  // Load existing token
  chrome.storage.sync.get(['gcp_token'], (result) => {
    if (result.gcp_token) {
      tokenInput.value = result.gcp_token;
      statusDiv.textContent = 'Key ready in vault.';
    }
  });

  document.getElementById('save').addEventListener('click', () => {
    const token = tokenInput.value;
    chrome.storage.sync.set({ gcp_token: token }, () => {
      statusDiv.textContent = 'Key saved to storage.';
      setTimeout(() => statusDiv.textContent = 'Key ready in vault.', 2000);
    });
  });

  document.getElementById('inject').addEventListener('click', () => {
    const token = tokenInput.value;
    if (!token) {
      statusDiv.textContent = 'Error: No token provided.';
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        statusDiv.textContent = 'Error: No active tab found.';
        return;
      }

      statusDiv.textContent = 'Injecting...';
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'injectToken', token: token }, (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error: Refresh the page first.';
          console.error(chrome.runtime.lastError);
          return;
        }

        if (response && response.status === 'success') {
          statusDiv.textContent = 'Vault unlocked!';
          setTimeout(() => window.close(), 1000);
        } else if (response && response.status === 'not_found') {
          statusDiv.textContent = 'Target input not found.';
        } else {
          statusDiv.textContent = 'Unknown error occurred.';
        }
      });
    });
  });
});
