document.addEventListener('DOMContentLoaded', function() {
  const inspectAllButton = document.getElementById('inspectAll');
  const inspectSelectedButton = document.getElementById('inspectSelected');
  const resultDiv = document.getElementById('result');
  const statusDiv = document.getElementById('status');
  const refreshStatsButton = document.getElementById('refreshStats');
  const clearCacheButton = document.getElementById('clearCache');
  const cacheStatsDiv = document.getElementById('cacheStats');
  const cacheUsageBar = document.getElementById('cacheUsageBar');
  const themeToggleButton = document.getElementById('themeToggle');

  // Theme management
  const THEME_KEY = 'theme_preference';
  const SYSTEM_THEME_KEY = 'use_system_theme';
  
  // Function to detect system theme
  function detectSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Function to set theme
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update theme toggle icon
    themeToggleButton.innerHTML = theme === 'light' 
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
        </svg>`;
  }

  // Function to toggle theme
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    // Save preference and disable system theme
    chrome.storage.local.set({ 
      [THEME_KEY]: newTheme,
      [SYSTEM_THEME_KEY]: false
    });
  }

  // Function to handle system theme changes
  function handleSystemThemeChange(e) {
    chrome.storage.local.get([SYSTEM_THEME_KEY], function(result) {
      if (result[SYSTEM_THEME_KEY]) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Set up system theme listener
  const systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeMediaQuery.addListener(handleSystemThemeChange);

  // Load saved theme preferences
  chrome.storage.local.get([THEME_KEY, SYSTEM_THEME_KEY], function(result) {
    if (result[SYSTEM_THEME_KEY]) {
      // Use system theme
      setTheme(detectSystemTheme());
    } else {
      // Use saved theme preference
      const savedTheme = result[THEME_KEY] || 'dark';
      setTheme(savedTheme);
    }
  });

  // Theme toggle event listener
  themeToggleButton.addEventListener('click', toggleTheme);

  // Function to show status message
  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${isError ? 'error' : 'success'}`;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  // Function to ensure content script is injected
  async function ensureContentScriptInjected(tabId) {
    try {
      // Try to inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log('Content script injected successfully');
    } catch (error) {
      // Script might already be injected, ignore the error
      console.log('Content script might already be injected:', error);
    }
  }

  // Function to send message with retry
  async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Ensure content script is injected before sending message
        await ensureContentScriptInjected(tabId);
        
        // Add a small delay to allow the content script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const response = await chrome.tabs.sendMessage(tabId, message);
        return response;
      } catch (error) {
        console.log(`Attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) throw error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Function to update cache statistics
  async function updateCacheStats() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await sendMessageWithRetry(tab.id, { action: 'getCacheStats' });
      
      if (response.success) {
        const stats = response.stats;
        const maxEntries = 1000; // From CACHE_CONFIG.maxSize
        
        // Update cache statistics display
        cacheStatsDiv.innerHTML = `
          <p>Total Entries: ${stats.totalEntries}/${maxEntries}</p>
          <p>Expired Entries: ${stats.expiredEntries}</p>
          <p>Oldest Entry: ${stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleString() : 'None'}</p>
          <p>Newest Entry: ${stats.newestEntry ? new Date(stats.newestEntry).toLocaleString() : 'None'}</p>
        `;
        
        // Update progress bar
        const usagePercentage = (stats.totalEntries / maxEntries) * 100;
        cacheUsageBar.style.width = `${usagePercentage}%`;
        cacheUsageBar.style.backgroundColor = usagePercentage > 80 ? 'var(--danger-color)' : 'var(--primary-color)';
      }
    } catch (error) {
      console.error('Error updating cache stats:', error);
      cacheStatsDiv.innerHTML = 'Error loading cache statistics';
      showStatus('Error: Could not connect to content script. Please refresh the page.', true);
    }
  }

  // Function to clear cache
  async function clearCache() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await sendMessageWithRetry(tab.id, { action: 'clearCache' });
      
      if (response.success) {
        showStatus('Cache cleared successfully');
        updateCacheStats();
      } else {
        showStatus('Error clearing cache: ' + response.message, true);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      showStatus('Error: Could not connect to content script. Please refresh the page.', true);
    }
  }

  // Function to inspect all links
  async function inspectAllLinks() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      inspectAllButton.disabled = true;
      resultDiv.textContent = 'Analyzing links...';
      
      const response = await sendMessageWithRetry(tab.id, { action: 'inspectAllLinks' });
      
      resultDiv.textContent = response.message;
      showStatus(response.safe ? 'All links are safe!' : 'Some links may be unsafe');
      updateCacheStats();
    } catch (error) {
      console.error('Error inspecting links:', error);
      resultDiv.textContent = 'Error: Could not connect to content script. Please refresh the page and try again.';
      showStatus('Error: Could not connect to content script. Please refresh the page.', true);
    } finally {
      inspectAllButton.disabled = false;
    }
  }

  // Function to inspect selected link
  async function inspectSelectedLink() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      inspectSelectedButton.disabled = true;
      resultDiv.textContent = 'Analyzing selected link...';
      
      const response = await sendMessageWithRetry(tab.id, { action: 'inspectSelectedLink' });
      
      resultDiv.textContent = response.message;
      showStatus(response.safe ? 'Link is safe!' : 'Link may be unsafe');
      updateCacheStats();
    } catch (error) {
      console.error('Error inspecting selected link:', error);
      resultDiv.textContent = 'Error: Could not connect to content script. Please refresh the page and try again.';
      showStatus('Error: Could not connect to content script. Please refresh the page.', true);
    } finally {
      inspectSelectedButton.disabled = false;
    }
  }

  // Event listeners
  inspectAllButton.addEventListener('click', inspectAllLinks);
  inspectSelectedButton.addEventListener('click', inspectSelectedLink);
  refreshStatsButton.addEventListener('click', updateCacheStats);
  clearCacheButton.addEventListener('click', clearCache);

  // Initial cache stats update
  updateCacheStats();
}); 