// Cache configuration
const CACHE_CONFIG = {
  maxSize: 1000, // Maximum number of URLs to cache
  maxAge: 30 * 60 * 1000, // Cache entries expire after 30 minutes
  storageKey: 'urlCache'
};

// Cache implementation
const urlCache = {
  entries: new Map(),
  
  async loadFromStorage() {
    try {
      const result = await chrome.storage.local.get(CACHE_CONFIG.storageKey);
      if (result[CACHE_CONFIG.storageKey]) {
        const storedData = JSON.parse(result[CACHE_CONFIG.storageKey]);
        // Convert stored data back to Map
        this.entries = new Map(Object.entries(storedData));
        console.log('Loaded cache from storage:', this.entries.size, 'entries');
      }
    } catch (error) {
      console.error('Error loading cache from storage:', error);
    }
  },
  
  async saveToStorage() {
    try {
      // Convert Map to object for storage
      const dataToStore = Object.fromEntries(this.entries);
      await chrome.storage.local.set({
        [CACHE_CONFIG.storageKey]: JSON.stringify(dataToStore)
      });
      console.log('Saved cache to storage:', this.entries.size, 'entries');
    } catch (error) {
      console.error('Error saving cache to storage:', error);
    }
  },
  
  async set(url, data) {
    // Remove oldest entry if cache is full
    if (this.entries.size >= CACHE_CONFIG.maxSize) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }
    
    this.entries.set(url, {
      data: data,
      timestamp: Date.now()
    });
    
    // Save to storage
    await this.saveToStorage();
  },
  
  get(url) {
    const entry = this.entries.get(url);
    if (!entry) return null;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > CACHE_CONFIG.maxAge) {
      this.entries.delete(url);
      this.saveToStorage(); // Save after removing expired entry
      return null;
    }
    
    return entry.data;
  },
  
  async clear() {
    this.entries.clear();
    await this.saveToStorage();
  },

  getStats() {
    return {
      totalEntries: this.entries.size,
      oldestEntry: this.entries.size > 0 ? Math.min(...Array.from(this.entries.values()).map(e => e.timestamp)) : null,
      newestEntry: this.entries.size > 0 ? Math.max(...Array.from(this.entries.values()).map(e => e.timestamp)) : null,
      expiredEntries: Array.from(this.entries.values()).filter(e => Date.now() - e.timestamp > CACHE_CONFIG.maxAge).length
    };
  }
};

// Function to check URL against Google Safe Browsing API
async function checkSafeBrowsing(url) {
  try {
    // Check cache first
    const cachedResult = urlCache.get(url);
    if (cachedResult) {
      console.log('Using cached Safe Browsing result for:', url);
      return cachedResult;
    }

    // You'll need to replace this with your actual API key
    const API_KEY = 'YOUR_API_KEY';
    const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;
    
    const requestBody = {
      client: {
        clientId: "your-client-id",
        clientVersion: "1.0.0"
      },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION"
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: url }]
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    // Cache the result
    urlCache.set(url, data);
    
    return data;
  } catch (error) {
    console.error('Safe Browsing API error:', error);
    return null;
  }
}

// Function to analyze a link using AI
async function analyzeLink(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname.toLowerCase();
    const search = urlObj.search.toLowerCase();
    
    // Comprehensive list of suspicious patterns
    const suspiciousPatterns = {
      urlShorteners: [
        'bit.ly',
        'tinyurl.com',
        'goo.gl',
        't.co',
        'ow.ly',
        'is.gd',
        'v.gd',
        'buff.ly'
      ],
      suspiciousKeywords: [
        'phishing',
        'malware',
        'virus',
        'hack',
        'exploit',
        'crack',
        'warez',
        'keygen',
        'cracked',
        'hacked',
        'free-download',
        'download-free'
      ],
      suspiciousExtensions: [
        '.exe',
        '.msi',
        '.bat',
        '.cmd',
        '.ps1',
        '.vbs',
        '.js',
        '.jar',
        '.zip',
        '.rar'
      ],
      suspiciousDomains: [
        'free-downloads.com',
        'warez.com',
        'cracks.com',
        'keygens.com'
      ]
    };

    // Check for suspicious patterns
    const checks = {
      isUrlShortener: suspiciousPatterns.urlShorteners.some(shortener => domain.includes(shortener)),
      hasSuspiciousKeyword: suspiciousPatterns.suspiciousKeywords.some(keyword => 
        path.includes(keyword) || search.includes(keyword)
      ),
      hasSuspiciousExtension: suspiciousPatterns.suspiciousExtensions.some(ext => 
        path.endsWith(ext)
      ),
      isSuspiciousDomain: suspiciousPatterns.suspiciousDomains.some(suspiciousDomain => 
        domain.includes(suspiciousDomain)
      ),
      hasIPAddress: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain),
      hasUnusualCharacters: /[^a-zA-Z0-9.-]/.test(domain)
    };

    // Check Google Safe Browsing API
    const safeBrowsingResult = await checkSafeBrowsing(url);
    const hasSafeBrowsingThreat = safeBrowsingResult && safeBrowsingResult.matches && safeBrowsingResult.matches.length > 0;
    
    if (hasSafeBrowsingThreat) {
      checks.hasSafeBrowsingThreat = true;
      checks.threatTypes = safeBrowsingResult.matches.map(match => match.threatType);
    }

    // Calculate risk score
    const riskScore = Object.values(checks).filter(Boolean).length;
    const isSuspicious = riskScore > 0;

    // Generate detailed message
    let message = `Analysis of ${domain}:\n`;
    if (checks.isUrlShortener) message += "⚠️ Contains URL shortener\n";
    if (checks.hasSuspiciousKeyword) message += "⚠️ Contains suspicious keywords\n";
    if (checks.hasSuspiciousExtension) message += "⚠️ Contains suspicious file extension\n";
    if (checks.isSuspiciousDomain) message += "⚠️ Matches known suspicious domain\n";
    if (checks.hasIPAddress) message += "⚠️ Uses IP address instead of domain name\n";
    if (checks.hasUnusualCharacters) message += "⚠️ Contains unusual characters in domain\n";
    if (checks.hasSafeBrowsingThreat) {
      message += "⚠️ Google Safe Browsing detected threats:\n";
      checks.threatTypes.forEach(threat => {
        message += `  - ${threat}\n`;
      });
    }
    
    if (!isSuspicious) {
      message = `✅ ${domain} appears to be safe. No suspicious patterns detected.`;
    } else {
      message += `\nRisk Score: ${riskScore}/7 - Proceed with caution.`;
    }

    return {
      safe: !isSuspicious,
      message: message,
      details: {
        domain: domain,
        riskScore: riskScore,
        checks: checks,
        safeBrowsingResult: safeBrowsingResult,
        cacheStatus: urlCache.get(url) ? 'cached' : 'fresh'
      }
    };
  } catch (error) {
    return {
      safe: false,
      message: 'Error analyzing link: ' + error.message,
      details: { error: error.message }
    };
  }
}

// Function to get all links on the page
function getAllLinks() {
  const links = Array.from(document.getElementsByTagName('a'));
  return links.map(link => ({
    href: link.href,
    text: link.textContent.trim(),
    title: link.title || ''
  }));
}

// Function to get the currently selected link
function getSelectedLink() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const link = range.commonAncestorContainer.closest('a');
    return link ? {
      href: link.href,
      text: link.textContent.trim(),
      title: link.title || ''
    } : null;
  }
  return null;
}

// Initialize the content script
async function initializeContentScript() {
  console.log('Content script initialized');
  
  // Load cache from storage
  await urlCache.loadFromStorage();
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'inspectAllLinks') {
      (async () => {
        try {
          const links = getAllLinks();
          if (links.length === 0) {
            sendResponse({
              safe: true,
              message: 'No links found on this page.'
            });
            return;
          }

          // Analyze the first 5 links for demonstration
          const linksToAnalyze = links.slice(0, 5);
          const results = await Promise.all(linksToAnalyze.map(link => analyzeLink(link.href)));
          const unsafeLinks = results.filter(r => !r.safe);
          
          // Generate detailed report
          let message = `Analyzed ${linksToAnalyze.length} links:\n\n`;
          results.forEach((result, index) => {
            const link = linksToAnalyze[index];
            message += `${result.safe ? '✅' : '⚠️'} ${link.text || link.href}\n`;
            message += `${result.message}\n`;
            if (result.details.cacheStatus) {
              message += `(Result ${result.details.cacheStatus})\n`;
            }
            message += '\n';
          });

          const cacheStats = urlCache.getStats();
          sendResponse({
            safe: unsafeLinks.length === 0,
            message: message,
            details: {
              totalLinks: linksToAnalyze.length,
              unsafeLinks: unsafeLinks.length,
              results: results,
              cacheStats: cacheStats
            }
          });
        } catch (error) {
          console.error('Error in inspectAllLinks:', error);
          sendResponse({
            safe: false,
            message: 'Error analyzing links: ' + error.message
          });
        }
      })();
      return true; // Will respond asynchronously
    }

    if (request.action === 'inspectSelectedLink') {
      (async () => {
        try {
          const selectedLink = getSelectedLink();
          if (!selectedLink) {
            sendResponse({
              safe: true,
              message: 'No link selected. Please select a link on the page.'
            });
            return;
          }

          const result = await analyzeLink(selectedLink.href);
          sendResponse(result);
        } catch (error) {
          console.error('Error in inspectSelectedLink:', error);
          sendResponse({
            safe: false,
            message: 'Error analyzing selected link: ' + error.message
          });
        }
      })();
      return true; // Will respond asynchronously
    }

    if (request.action === 'clearCache') {
      (async () => {
        try {
          await urlCache.clear();
          sendResponse({
            success: true,
            message: 'Cache cleared successfully',
            stats: urlCache.getStats()
          });
        } catch (error) {
          sendResponse({
            success: false,
            message: 'Error clearing cache: ' + error.message
          });
        }
      })();
      return true;
    }

    if (request.action === 'getCacheStats') {
      sendResponse({
        success: true,
        stats: urlCache.getStats()
      });
      return true;
    }
  });

  // Notify that the content script is ready
  chrome.runtime.sendMessage({ action: 'contentScriptReady' });
}

// Initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
} 