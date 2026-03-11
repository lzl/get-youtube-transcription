class YoutubeTranscriptionExtension {
  static readTranscriptEntriesFromSegmentNodes(segmentNodes) {
    return Array.from(segmentNodes)
      .map((segmentNode) => {
        const legacyTimestamp = segmentNode.querySelector('div.segment-timestamp')?.textContent?.trim();
        const legacyText = segmentNode.querySelector('yt-formatted-string')?.textContent?.trim();

        if (legacyTimestamp && legacyText) {
          return [legacyTimestamp, legacyText];
        }

        const modernTimestamp = segmentNode.querySelector('.ytwTranscriptSegmentViewModelTimestamp')
          ?.textContent?.trim();
        if (!modernTimestamp) {
          return null;
        }

        let modernText = segmentNode.querySelector('span.yt-core-attributed-string[role="text"]')
          ?.textContent?.trim();

        if (!modernText) {
          modernText = YoutubeTranscriptionExtension.extractModernTranscriptFallbackText(
            segmentNode,
            modernTimestamp
          );
        }

        if (!modernText) {
          return null;
        }

        return [modernTimestamp, modernText];
      })
      .filter((entry) => entry && entry[1]);
  }

  static extractModernTranscriptFallbackText(segmentNode, timestamp) {
    let text = (segmentNode.textContent || '').trim();
    const accessibilityLabel = segmentNode.querySelector('.ytwTranscriptSegmentViewModelTimestampA11yLabel')
      ?.textContent?.trim();

    if (timestamp && text.startsWith(timestamp)) {
      text = text.slice(timestamp.length).trim();
    }

    if (accessibilityLabel && text.startsWith(accessibilityLabel)) {
      text = text.slice(accessibilityLabel.length).trim();
    }

    return text;
  }

  constructor() {
    this.transcriptButton = null;
    this.isExtracting = false;
    this.containerObserver = null;
    this.buttonCheckInterval = null;
    this.potTokens = new Map();

    this.initializeExtension();
  }

  initializeExtension() {
    if (!window.TranscriptCore) {
      console.error('TranscriptCore is not available');
      return;
    }

    this.setupGlobalDebugTool();
    this.observePageNavigation();
    this.startObservingButtonContainer();
  }

  observePageNavigation() {
    let lastUrl = window.location.href;

    const handleNavigationChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl === lastUrl) {
        return;
      }

      lastUrl = currentUrl;
      this.cleanupPreviousButton();
      this.startObservingButtonContainer();
    };

    new MutationObserver(handleNavigationChange).observe(document, {
      subtree: true,
      childList: true,
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

    if (this.buttonCheckInterval) {
      clearInterval(this.buttonCheckInterval);
      this.buttonCheckInterval = null;
    }

    if (this.transcriptButton && document.contains(this.transcriptButton)) {
      this.transcriptButton.remove();
    }

    this.transcriptButton = null;
  }

  startObservingButtonContainer() {
    if (!this.isYoutubeVideoPage()) {
      return;
    }

    this.attemptToAddButton();
    this.setupContainerObserver();

    if (this.buttonCheckInterval) {
      clearInterval(this.buttonCheckInterval);
    }

    this.buttonCheckInterval = setInterval(() => {
      if (!this.isYoutubeVideoPage()) {
        return;
      }

      if (!this.transcriptButton || !document.contains(this.transcriptButton)) {
        this.transcriptButton = null;
        this.attemptToAddButton();
      }
    }, 1500);
  }

  setupContainerObserver() {
    this.containerObserver = new MutationObserver(() => {
      this.attemptToAddButton();
    });

    const observeTarget = document.querySelector('#primary, #page-manager, ytd-app') || document.body;
    this.containerObserver.observe(observeTarget, {
      childList: true,
      subtree: true,
    });
  }

  isYoutubeVideoPage() {
    return Boolean(this.getVideoId());
  }

  getVideoId(url = window.location.href) {
    return window.TranscriptCore.getVideoIdFromUrl(url);
  }

  findSuitableButtonContainer() {
    const watchSelectors = [
      '#actions-inner #top-level-buttons-computed',
      '#top-level-buttons-computed',
      '#actions-inner',
      '#menu-container',
    ];

    for (const selector of watchSelectors) {
      const element = document.querySelector(selector);
      if (element && this.isValidWatchContainer(element)) {
        return element;
      }
    }

    const shortsSelectors = [
      'ytd-reel-player-overlay-renderer #actions',
      'ytd-reel-player-overlay-renderer #action-buttons',
      'ytd-shorts #actions',
    ];

    for (const selector of shortsSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return null;
  }

  isValidWatchContainer(element) {
    const hasActionButtons = element.querySelector(
      'button[aria-label*="like" i], button[aria-label*="Share" i], button[aria-label*="Save" i]'
    );
    const isInTitleArea = element.closest('#title, .title, ytd-video-primary-info-renderer #container');

    return Boolean(hasActionButtons) && !isInTitleArea;
  }

  attemptToAddButton() {
    if (!this.isYoutubeVideoPage()) {
      return;
    }

    if (this.transcriptButton && document.contains(this.transcriptButton)) {
      return;
    }

    const container = this.findSuitableButtonContainer();
    if (!container) {
      return;
    }

    this.createAndInsertButton(container);
  }

  createAndInsertButton(targetContainer) {
    if (this.transcriptButton && document.contains(this.transcriptButton)) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yt-transcript-extractor-btn';
    button.title = 'Get video transcript with one click';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"></path>
      </svg>
      <span>Transcript</span>
    `;
    button.addEventListener('click', () => {
      void this.handleTranscriptButtonClick();
    });

    targetContainer.appendChild(button);
    this.transcriptButton = button;
  }

  async handleTranscriptButtonClick() {
    if (this.isExtracting) {
      return;
    }

    this.isExtracting = true;
    this.updateButtonState('loading');

    try {
      const transcriptPackage = await this.extractTranscriptPackage();
      await this.copyTextToClipboard(transcriptPackage);
      this.showUserNotification(
        `Transcript copied to clipboard! (${transcriptPackage.body.length} characters)`,
        'success'
      );
    } catch (error) {
      console.error('Transcript extraction failed:', error);
      this.showUserNotification(`Failed to get transcript: ${error.message}`, 'error');
    } finally {
      this.isExtracting = false;
      this.updateButtonState('normal');
    }
  }

  async extractTranscriptPackage() {
    const sourceUrl = this.getTranscriptSourceUrl();
    const html = await this.fetchHtml(sourceUrl);
    const resolvedPageData = window.TranscriptCore.resolvePageData(html);

    let playerResponse = null;
    try {
      playerResponse = window.TranscriptCore.extractJsonBlob(html, 'ytInitialPlayerResponse');
    } catch (error) {
      playerResponse = null;
    }

    const videoId = this.getVideoId(sourceUrl);
    let transcriptEntries = await this.fetchTimedTextTranscript(playerResponse, videoId);

    if (!transcriptEntries.length) {
      transcriptEntries = await this.fetchTranscriptFromPanel();
    }

    if (!transcriptEntries.length) {
      throw new Error('No captions found. This video may not have a transcript available.');
    }

    return {
      title: resolvedPageData.title || this.getPageTitle(),
      url: window.location.href,
      body: this.formatTranscriptText(transcriptEntries),
      entries: transcriptEntries,
    };
  }

  getTranscriptSourceUrl() {
    if (window.location.pathname.startsWith('/shorts/')) {
      const videoId = this.getVideoId();
      if (!videoId) {
        throw new Error('Could not determine Shorts video ID');
      }

      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    return window.location.href;
  }

  async fetchHtml(url) {
    const response = await fetch(url, {
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube page (${response.status})`);
    }

    return response.text();
  }

  async fetchTimedTextTranscript(playerResponse, videoId) {
    const baseUrl = window.TranscriptCore.getCaptionBaseUrl(playerResponse);
    if (!baseUrl) {
      return [];
    }

    const potToken = await this.capturePotToken(videoId);
    const timedTextUrl = window.TranscriptCore.buildTimedTextUrl(baseUrl, potToken);

    if (!timedTextUrl) {
      return [];
    }

    try {
      const response = await fetch(timedTextUrl, {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      return window.TranscriptCore.normalizeTranscriptSegments(payload.events);
    } catch (error) {
      console.warn('Timedtext transcript fetch failed:', error);
      return [];
    }
  }

  async capturePotToken(videoId) {
    const cacheKey = `yt-caption-potoken-${videoId || ''}`;
    if (this.potTokens.has(cacheKey)) {
      return this.potTokens.get(cacheKey);
    }

    const subtitlesButton = document.querySelector(
      '#movie_player button.ytp-subtitles-button, #movie_player .ytp-right-controls-left button.ytp-subtitles-button'
    );

    if (!subtitlesButton) {
      return '';
    }

    try {
      performance.clearResourceTimings();

      const tokenPromise = new Promise((resolve) => {
        subtitlesButton.addEventListener(
          'click',
          async () => {
            for (let index = 0; index <= 500; index += 50) {
              await this.waitForMilliseconds(50);

              const entries = performance.getEntriesByType('resource');
              const timedTextEntry = entries
                .filter((entry) => entry.name.includes('/api/timedtext?'))
                .pop();

              if (!timedTextEntry) {
                continue;
              }

              const token = new URL(timedTextEntry.name).searchParams.get('pot');
              if (token) {
                this.potTokens.set(cacheKey, token);
                resolve(token);
                return;
              }
            }

            resolve('');
          },
          { once: true }
        );
      });

      subtitlesButton.click();
      subtitlesButton.click();

      const token = await Promise.race([
        tokenPromise,
        this.waitForMilliseconds(600).then(() => ''),
      ]);

      if (token) {
        this.potTokens.set(cacheKey, token);
      }

      return token || '';
    } catch (error) {
      console.warn('POT token capture failed:', error);
      return '';
    }
  }

  async fetchTranscriptFromPanel() {
    const transcriptButton = await this.findTranscriptPanelButton();
    if (!transcriptButton) {
      return [];
    }

    transcriptButton.click();

    const hasSegments = await this.waitForSelector(
      [
        '#segments-container > ytd-transcript-segment-renderer',
        'ytd-engagement-panel-section-list-renderer[target-id="PAmodern_transcript_view"] transcript-segment-view-model',
      ].join(', '),
      3000
    );
    if (!hasSegments) {
      return [];
    }

    await this.waitForMilliseconds(300);

    const segmentNodes = document.querySelectorAll(
      [
        'ytd-engagement-panel-section-list-renderer[target-id="PAmodern_transcript_view"] transcript-segment-view-model',
        '#segments-container > ytd-transcript-segment-renderer',
      ].join(', ')
    );

    return YoutubeTranscriptionExtension.readTranscriptEntriesFromSegmentNodes(segmentNodes);
  }

  async findTranscriptPanelButton() {
    await this.expandVideoDescription();

    const selectors = [
      'button[aria-label="Show transcript"]',
      '#button[aria-label="Show transcript"]',
      'ytd-video-description-transcript-section-renderer #primary-button button',
      '#primary-button > ytd-button-renderer > yt-button-shape > button',
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && this.isElementVisible(button)) {
        return button;
      }
    }

    const fallbackButtons = document.querySelectorAll('button');
    return Array.from(fallbackButtons).find((button) => {
      const text = (button.textContent || '').toLowerCase();
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

      return (
        this.isElementVisible(button) &&
        ['transcript', 'show transcript', '转录', '字幕'].some((keyword) => {
          return text.includes(keyword) || ariaLabel.includes(keyword);
        })
      );
    }) || null;
  }

  async expandVideoDescription() {
    const selectors = [
      'tp-yt-paper-button#expand',
      '#description tp-yt-paper-button',
      '[id="more"]:not([hidden])',
      'ytd-text-inline-expander #expand',
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && this.isElementVisible(button)) {
        button.click();
        await this.waitForMilliseconds(300);
        return;
      }
    }
  }

  formatTranscriptText(entries) {
    return entries
      .map(([timestamp, text]) => {
        return timestamp ? `${timestamp}: ${text}` : text;
      })
      .join('\n');
  }

  getPageTitle() {
    return (
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('#title h1 yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('h1.title')?.textContent?.trim() ||
      'Unknown Title'
    );
  }

  async copyTextToClipboard(transcriptPackage) {
    const formattedText = `${transcriptPackage.title}\n${transcriptPackage.url}\n\n${transcriptPackage.body}`;

    try {
      await navigator.clipboard.writeText(formattedText);
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = formattedText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  updateButtonState(state) {
    if (!this.transcriptButton) {
      return;
    }

    const label = this.transcriptButton.querySelector('span');
    if (!label) {
      return;
    }

    if (state === 'loading') {
      label.textContent = 'Loading...';
      this.transcriptButton.disabled = true;
      return;
    }

    label.textContent = 'Transcript';
    this.transcriptButton.disabled = false;
  }

  showUserNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `yt-transcript-notification yt-transcript-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  waitForMilliseconds(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  waitForSelector(selector, timeout = 3000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        resolve(true);
        return;
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(true);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
    });
  }

  timestampToMilliseconds(timestamp) {
    const parts = timestamp.split(':').map((part) => Number(part));

    if (parts.length === 2) {
      return ((parts[0] * 60) + parts[1]) * 1000;
    }

    if (parts.length === 3) {
      return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
    }

    return 0;
  }

  isElementVisible(element) {
    if (!element) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    if (element.offsetWidth === 0 || element.offsetHeight === 0) {
      return false;
    }

    return element.offsetParent !== null;
  }

  setupGlobalDebugTool() {
    window.getTranscript = async () => {
      return this.extractTranscriptPackage();
    };

    window.getTranscriptDebug = async () => {
      const sourceUrl = this.getTranscriptSourceUrl();
      const html = await this.fetchHtml(sourceUrl);

      let pageData = null;
      let playerResponse = null;

      try {
        pageData = window.TranscriptCore.resolvePageData(html);
      } catch (error) {
        pageData = { error: error.message };
      }

      try {
        playerResponse = window.TranscriptCore.extractJsonBlob(html, 'ytInitialPlayerResponse');
      } catch (error) {
        playerResponse = null;
      }

      return {
        sourceUrl,
        pageData,
        captionBaseUrl: window.TranscriptCore.getCaptionBaseUrl(playerResponse),
      };
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { YoutubeTranscriptionExtension };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new YoutubeTranscriptionExtension();
    });
  } else {
    new YoutubeTranscriptionExtension();
  }
}
