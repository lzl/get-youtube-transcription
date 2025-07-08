// Get Youtube Transcription (just one click) - Content Script
class YoutubeTranscriptionExtension {
  constructor() {
    this.transcriptButton = null;
    this.isExtracting = false;
    this.containerObserver = null;
    this.capturedPlayerData = null;
    
    this.initializeExtension();
  }

  initializeExtension() {
    this.setupDataCapture();
    this.setupGlobalDebugTool();
    this.observePageNavigation();
    this.startObservingButtonContainer();
  }

  // ==================== Data Capture Section ====================
  setupDataCapture() {
    console.log('Setting up data capture mechanism...');
    
    // Monitor DOM for script injection
    this.observeScriptInjection();
    
    // Periodically check window object for YouTube data
    this.checkWindowForYoutubeData();
  }

  observeScriptInjection() {
    const scriptObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeName === 'SCRIPT' && node.textContent) {
              this.extractYoutubeDataFromScript(node.textContent);
            }
          }
        }
      }
    });
    
    scriptObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  checkWindowForYoutubeData() {
    const checkInterval = setInterval(() => {
      if (window.ytInitialPlayerResponse && !this.capturedPlayerData) {
        this.capturedPlayerData = window.ytInitialPlayerResponse;
        console.log('Captured ytInitialPlayerResponse from window object');
        clearInterval(checkInterval);
      }
    }, 100);
    
    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);
  }

  extractYoutubeDataFromScript(scriptContent) {
    const dataTypes = [
      { name: 'ytInitialPlayerResponse', patterns: [
        /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/,
        /ytInitialPlayerResponse\s*=\s*({.+?});/,
        /var\s+ytInitialPlayerResponse\s*=\s*({.+?});/
      ]},
      { name: 'ytInitialData', patterns: [
        /window\["ytInitialData"\]\s*=\s*({.+?});/,
        /ytInitialData\s*=\s*({.+?});/,
        /var\s+ytInitialData\s*=\s*({.+?});/
      ]}
    ];

    for (const dataType of dataTypes) {
      if (scriptContent.includes(dataType.name) && !window[dataType.name]) {
        for (const pattern of dataType.patterns) {
          const match = scriptContent.match(pattern);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              window[dataType.name] = data;
              if (dataType.name === 'ytInitialPlayerResponse') {
                this.capturedPlayerData = data;
              }
              console.log(`Successfully extracted ${dataType.name} from script`);
              break;
            } catch (e) {
              console.error(`Failed to parse ${dataType.name}:`, e);
            }
          }
        }
      }
    }
  }

  // ==================== Page Navigation Section ====================
  observePageNavigation() {
    let lastUrl = location.href;
    
    const handleNavigationChange = () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('Page navigation detected:', currentUrl);
        
        this.cleanupPreviousButton();
        this.startObservingButtonContainer();
      }
    };

    // Multiple ways to detect navigation changes
    new MutationObserver(handleNavigationChange).observe(document, { 
      subtree: true, 
      childList: true 
    });

    window.addEventListener('popstate', handleNavigationChange);
    window.addEventListener('yt-navigate-finish', handleNavigationChange);
    window.addEventListener('yt-page-data-updated', handleNavigationChange);
  }

  cleanupPreviousButton() {
    if (this.containerObserver) {
      this.containerObserver.disconnect();
      this.containerObserver = null;
    }
    this.transcriptButton = null;
  }

  // ==================== Button Management Section ====================
  startObservingButtonContainer() {
    if (!this.isYoutubeVideoPage()) {
      return;
    }

    console.log('Starting to observe for button container...');
    
    // Try to add button immediately
    this.attemptToAddButton();
    
    // Setup observer for container appearance
    this.setupContainerObserver();
    
    // Listen to YouTube-specific events
    this.listenToYoutubeEvents();
  }

  setupContainerObserver() {
    this.containerObserver = new MutationObserver((mutations) => {
      const hasRelevantChanges = mutations.some(mutation => {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && this.isButtonContainerElement(node)) {
              return true;
            }
          }
        }
        return false;
      });
      
      if (hasRelevantChanges) {
        console.log('Detected button container changes, attempting to add button');
        this.attemptToAddButton();
      }
    });

    const observeTarget = document.querySelector('#primary, #page-manager, ytd-app') || document.body;
    this.containerObserver.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'id']
    });
  }

  listenToYoutubeEvents() {
    const youtubeEvents = [
      'yt-navigate-finish',
      'yt-page-data-updated', 
      'yt-player-updated',
      'yt-action-panel-update',
      'yt-watch-comments-loaded'
    ];
    
    youtubeEvents.forEach(eventName => {
      window.addEventListener(eventName, () => {
        console.log(`Detected YouTube event: ${eventName}`);
        setTimeout(() => this.attemptToAddButton(), 100);
      });
    });
  }

  isButtonContainerElement(element) {
    const containerSelectors = [
      '#actions-inner',
      '#top-level-buttons-computed', 
      '#menu-container',
      '.ytd-menu-renderer',
      '[class*="actions"]',
      '[id*="actions"]'
    ];
    
    return containerSelectors.some(selector => {
      return element.matches?.(selector) || element.querySelector?.(selector);
    });
  }

  attemptToAddButton() {
    // Check if button already exists and is in DOM
    if (this.transcriptButton && document.contains(this.transcriptButton)) {
      return;
    }

    // Clean up invalid button reference
    if (this.transcriptButton && !document.contains(this.transcriptButton)) {
      this.transcriptButton = null;
    }

    if (!this.isYoutubeVideoPage()) {
      return;
    }

    const container = this.findSuitableButtonContainer();
    if (container && this.isValidContainer(container)) {
      console.log('Found valid container, adding button');
      this.createAndInsertButton(container);
    }
  }

  isYoutubeVideoPage() {
    // Regular video page: /watch?v=videoId
    const isWatchPage = location.pathname === '/watch' && location.search.includes('v=');
    
    // Live video page: /live/videoId
    const isLivePage = location.pathname.startsWith('/live/');
    
    return isWatchPage || isLivePage;
  }

  findSuitableButtonContainer() {
    // Priority order for container selectors
    const containerSelectors = [
      '#actions-inner #top-level-buttons-computed',
      '#top-level-buttons-computed',
      '#actions-inner',
      '#actions #menu-container',
      '#menu-container'
    ];

    // Try direct selectors first
    for (const selector of containerSelectors) {
      const element = document.querySelector(selector);
      if (element && this.isValidContainer(element)) {
        return element;
      }
    }

    // Fallback: find container by existing buttons
    const existingButtonSelectors = [
      'button[aria-label*="like" i]',
      'button[aria-label*="Share" i]', 
      'button[aria-label*="Save" i]'
    ];

    for (const buttonSelector of existingButtonSelectors) {
      const button = document.querySelector(buttonSelector);
      if (button) {
        const container = button.closest('#top-level-buttons-computed, #actions-inner, #menu-container');
        if (container && this.isValidContainer(container)) {
          return container;
        }
      }
    }

    return null;
  }

  isValidContainer(element) {
    // Container should have other action buttons
    const hasActionButtons = element.querySelector('button[aria-label*="like" i], button[aria-label*="Share" i], button[aria-label*="Save" i]');
    
    // Container should not be in title area
    const isInTitleArea = element.closest('#title, .title, ytd-video-primary-info-renderer #container');
    
    return !!hasActionButtons && !isInTitleArea;
  }

  createAndInsertButton(targetContainer) {
    if (this.transcriptButton && document.contains(this.transcriptButton)) {
      return;
    }

    // Create button element
    this.transcriptButton = document.createElement('button');
    this.transcriptButton.className = 'yt-transcript-extractor-btn';
    this.transcriptButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
      <span>Transcript</span>
    `;
    
    this.transcriptButton.title = 'Get video transcript with one click';
    this.transcriptButton.addEventListener('click', () => this.handleTranscriptButtonClick());

    targetContainer.appendChild(this.transcriptButton);
    console.log('Transcript button successfully inserted');
    
    this.monitorButtonRemoval();
  }

  monitorButtonRemoval() {
    if (!this.transcriptButton) return;
    
    const removalObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node === this.transcriptButton || node.contains?.(this.transcriptButton)) {
              console.log('Transcript button was removed, attempting to re-add');
              this.transcriptButton = null;
              removalObserver.disconnect();
              setTimeout(() => this.attemptToAddButton(), 100);
              return;
            }
          }
        }
      }
    });

    const buttonContainer = this.transcriptButton.closest('#top-level-buttons-computed, #actions-inner, #menu-container') || 
                           this.transcriptButton.parentElement;
    if (buttonContainer) {
      removalObserver.observe(buttonContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  // ==================== Transcript Extraction Section ====================
  async handleTranscriptButtonClick() {
    if (this.isExtracting) {
      return;
    }

    this.isExtracting = true;
    this.updateButtonState('loading');

    console.log('=== Starting transcript extraction ===');
    console.log('Video URL:', window.location.href);

    try {
      const transcript = await this.extractTranscript();
      
      if (transcript) {
        console.log('Successfully extracted transcript, length:', transcript.length);
        await this.copyTextToClipboard(transcript);
        this.showUserNotification(`Transcript copied to clipboard! (${transcript.length} characters)`, 'success');
      } else {
        console.log('Failed to extract transcript');
        this.showUserNotification('No transcript found. Please ensure the video has captions/transcript available.', 'error');
        this.showDebugInformation();
      }
    } catch (error) {
      console.error('Error during transcript extraction:', error);
      this.showUserNotification('Failed to get transcript: ' + error.message, 'error');
    } finally {
      this.isExtracting = false;
      this.updateButtonState('normal');
      console.log('=== Transcript extraction completed ===');
    }
  }

  async extractTranscript() {
    try {
      console.log('Starting transcript extraction process...');
      const transcript = await this.extractTranscriptFromPage();
      if (transcript) {
        return transcript;
      }
    } catch (error) {
      console.log('Transcript extraction failed:', error);
    }
    
    return null;
  }

  async extractTranscriptFromPage() {
    console.log('Attempting to extract transcript from page...');
    
    // First expand video description where transcript button might be
    await this.expandVideoDescription();
    
    // Find and click transcript button
    const transcriptButton = await this.findTranscriptButton();
    
    if (!transcriptButton) {
      console.log('No visible transcript button found');
      return null;
    }
    
    console.log('Found transcript button, clicking...');
    transcriptButton.click();
    
    // Wait for transcript panel to load
    await this.waitForMilliseconds(2000);
    
    // Extract transcript content
    return await this.extractTranscriptContent();
  }

  async expandVideoDescription() {
    console.log('Expanding video description...');
    
    const expandButtonSelectors = [
      'tp-yt-paper-button#expand',
      'tp-yt-paper-button.ytd-video-secondary-info-renderer',
      '#description tp-yt-paper-button',
      '[id="more"]:not([hidden])',
      'ytd-text-inline-expander #expand'
    ];
    
    for (const selector of expandButtonSelectors) {
      const button = document.querySelector(selector);
      if (button && this.isElementVisible(button)) {
        console.log(`Clicking expand button: ${selector}`);
        button.click();
        await this.waitForMilliseconds(500);
        break;
      }
    }
  }

  async findTranscriptButton() {
    console.log('Searching for transcript button...');
    
    const searchStrategies = [
      // Look in description area
      () => {
        const buttons = document.querySelectorAll('#description button, #description-inner button');
        return Array.from(buttons).find(btn => 
          this.isTranscriptButton(btn) && this.isElementVisible(btn)
        );
      },
      
      // Look in video info area
      () => {
        const buttons = document.querySelectorAll('ytd-video-primary-info-renderer button');
        return Array.from(buttons).find(btn => 
          this.isTranscriptButton(btn) && this.isElementVisible(btn)
        );
      },
      
      // Global search
      () => {
        const buttons = document.querySelectorAll('button:not([aria-label*="Close"]):not([aria-label*="关闭"])');
        return Array.from(buttons).find(btn => 
          this.isTranscriptButton(btn) && this.isElementVisible(btn)
        );
      }
    ];
    
    for (const strategy of searchStrategies) {
      const button = strategy();
      if (button) {
        console.log('Found transcript button');
        return button;
      }
    }
    
    return null;
  }

  isTranscriptButton(button) {
    const text = (button.textContent || '').toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    
    const transcriptKeywords = ['transcript', '转录', '字幕'];
    
    return transcriptKeywords.some(keyword => 
      text.includes(keyword) || ariaLabel.includes(keyword)
    );
  }

  isElementVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (element.offsetWidth === 0 || element.offsetHeight === 0) return false;
    
    const rect = element.getBoundingClientRect();
    const inViewport = rect.top >= 0 && 
                       rect.left >= 0 && 
                       rect.bottom <= window.innerHeight && 
                       rect.right <= window.innerWidth;
    
    // Element might be below viewport but still accessible
    return element.offsetParent !== null && (inViewport || rect.top > 0);
  }

  async extractTranscriptContent() {
    console.log('Extracting transcript content...');
    
    await this.waitForMilliseconds(1000);
    
    // Find all transcript segment elements
    const segmentElements = document.querySelectorAll('ytd-transcript-segment-renderer');
    console.log(`Found ${segmentElements.length} transcript segments`);
    
    if (segmentElements.length > 0) {
      const transcriptLines = [];
      
      for (const segment of segmentElements) {
        const segmentData = this.extractSegmentData(segment);
        if (segmentData.text) {
          const line = segmentData.timestamp 
            ? `${segmentData.timestamp}: ${segmentData.text}`
            : segmentData.text;
          transcriptLines.push(line);
        }
      }
      
      if (transcriptLines.length > 0) {
        console.log(`Successfully extracted ${transcriptLines.length} transcript lines`);
        return transcriptLines.join('\n');
      }
    }
    
    console.log('Failed to extract transcript content');
    return null;
  }

  extractSegmentData(segment) {
    let text = '';
    let timestamp = null;
    
    // Extract timestamp first
    const timestampElement = segment.querySelector('[data-start-time], .segment-timestamp, [role="button"]');
    if (timestampElement) {
      // Try to get timestamp from data attribute first
      const dataStartTime = timestampElement.getAttribute('data-start-time');
      if (dataStartTime) {
        timestamp = this.formatTimestamp(dataStartTime.trim());
      } else {
        // If no data attribute, extract from text content
        // The timestamp is usually at the beginning of the text
        const fullText = timestampElement.textContent || '';
        const timestampMatch = fullText.match(/^\s*(\d+:\d+(?::\d+)?)\s*/);
        if (timestampMatch) {
          timestamp = timestampMatch[1];
        }
      }
    }
    
    // Extract text content
    const textSelectors = ['.segment-text', 'span:not([class*="timestamp"])'];
    for (const selector of textSelectors) {
      const element = segment.querySelector(selector);
      if (element) {
        text = element.textContent || '';
        break;
      }
    }
    
    // Fallback: get text from entire segment
    if (!text) {
      text = segment.textContent || '';
      // Remove timestamp from the beginning if present
      if (timestamp) {
        text = text.replace(new RegExp(`^\\s*${timestamp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '');
      }
    }
    
    // Clean up text
    text = this.cleanTranscriptText(text);
    
    return { text, timestamp };
  }

  cleanTranscriptText(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\s*-\s*/, '');
  }

  formatTimestamp(timeValue) {
    if (!timeValue) return null;
    
    // Already formatted
    if (typeof timeValue === 'string' && timeValue.includes(':')) {
      return timeValue.trim();
    }
    
    // Convert seconds to mm:ss format
    const totalSeconds = parseInt(timeValue, 10);
    if (!isNaN(totalSeconds)) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return null;
  }

  // ==================== Utility Section ====================
  async copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // Fallback method for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  updateButtonState(state) {
    if (!this.transcriptButton) return;

    const span = this.transcriptButton.querySelector('span');
    if (state === 'loading') {
      span.textContent = 'Loading...';
      this.transcriptButton.disabled = true;
    } else {
      span.textContent = 'Transcript';
      this.transcriptButton.disabled = false;
    }
  }

  showUserNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `yt-transcript-notification yt-transcript-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show animation
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto hide
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  waitForMilliseconds(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== Debug Section ====================
  setupGlobalDebugTool() {
    window.getTranscript = () => {
      console.log('=== YouTube Transcript Debug Tool ===');
      
      const transcriptPanel = document.querySelector('ytd-transcript-renderer');
      if (transcriptPanel) {
        console.log('Found transcript panel:', transcriptPanel);
        
        const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
        console.log('Transcript segments:', segments.length);
        
        if (segments.length > 0) {
          console.log('First 5 segments:');
          Array.from(segments).slice(0, 5).forEach((segment, index) => {
            console.log(`Segment ${index + 1}:`, segment.textContent?.trim());
          });
        }
      } else {
        console.log('No transcript panel found');
      }
      
      console.log('Caption data:', window.ytInitialPlayerResponse?.captions);
      
      return {
        transcriptPanel,
        captionData: window.ytInitialPlayerResponse?.captions
      };
    };
  }

  showDebugInformation() {
    console.log('=== Debug Information ===');
    
    // Check YouTube data
    console.log('--- YouTube Data Check ---');
    console.log('ytInitialPlayerResponse exists:', !!window.ytInitialPlayerResponse);
    console.log('ytInitialData exists:', !!window.ytInitialData);
    
    if (window.ytInitialPlayerResponse?.captions) {
      const tracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer?.captionTracks;
      console.log('Caption tracks:', tracks?.length || 0);
      tracks?.forEach((track, i) => {
        console.log(`  Track ${i + 1}: ${track.languageCode} - ${track.name?.simpleText || 'Unnamed'}`);
      });
    }
    
    // Check transcript buttons
    console.log('\n--- Transcript Button Check ---');
    const transcriptButtons = document.querySelectorAll('[aria-label*="Transcript"], [aria-label*="转录"], [aria-label*="transcript"]');
    console.log('Found transcript buttons:', transcriptButtons.length);
    
    // Check transcript panel
    console.log('\n--- Transcript Panel Check ---');
    const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
    console.log('Transcript segments found:', transcriptSegments.length);
    
    console.log('\nFor more details, run window.getTranscript() in the console');
  }
}

// Initialize extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YoutubeTranscriptionExtension();
  });
} else {
  new YoutubeTranscriptionExtension();
}