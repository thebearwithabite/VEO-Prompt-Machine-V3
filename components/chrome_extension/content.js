
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'injectToken') {
    const input = document.getElementById('gcp-token-input');
    const button = document.getElementById('vault-unlock-btn');

    if (input) {
      try {
        // 1. Get the current value to compare
        const lastValue = input.value;
        
        // 2. Set the new value
        input.value = request.token;
        
        // 3. REACT TRACKER BYPASS (Crucial for React 16/17/18/19)
        // React tracks the value property. We need to manually trigger the setter 
        // on the prototype to bypass React's interception.
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, request.token);
        
        // 4. Update the internal tracker if it exists
        const tracker = input._valueTracker;
        if (tracker) {
          tracker.setValue(lastValue);
        }

        // 5. Dispatch events in sequence
        const eventOptions = { bubbles: true, cancelable: true };
        input.dispatchEvent(new Event('input', eventOptions));
        input.dispatchEvent(new Event('change', eventOptions));
        
        // Add a visual "flash" to the input to show it was updated
        input.style.transition = 'box-shadow 0.2s ease-in-out';
        input.style.boxShadow = '0 0 15px #6366f1';
        setTimeout(() => {
          input.style.boxShadow = 'none';
        }, 500);

        // 6. Optional: Auto-click the unlock button after a brief delay
        if (button && !button.disabled) {
          setTimeout(() => button.click(), 150);
        }

        sendResponse({ status: 'success' });
      } catch (err) {
        console.error("Aether Injector Error:", err);
        sendResponse({ status: 'error', message: err.message });
      }
    } else {
      sendResponse({ status: 'not_found' });
    }
  }
  return true; // Required for async sendResponse
});
