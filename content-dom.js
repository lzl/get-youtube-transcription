(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TranscriptContentDom = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const WATCH_CONTAINER_SELECTORS = [
    '#actions-inner #top-level-buttons-computed',
    '#top-level-buttons-computed',
    '#actions-inner',
    '#menu-container',
  ];

  const SHORTS_CONTAINER_SELECTORS = [
    'ytd-reel-player-overlay-renderer #actions',
    'ytd-reel-player-overlay-renderer #action-buttons',
    'ytd-shorts #actions',
  ];

  const TRANSCRIPT_PANEL_BUTTON_SELECTORS = [
    'ytd-video-description-transcript-section-renderer #primary-button button',
  ];

  const DESCRIPTION_EXPAND_SELECTORS = [
    'tp-yt-paper-button#expand',
    '#description tp-yt-paper-button',
    '[id="more"]:not([hidden])',
    'ytd-text-inline-expander #expand',
  ];

  const TRANSCRIPT_SEGMENT_SELECTOR = [
    'ytd-engagement-panel-section-list-renderer[target-id="PAmodern_transcript_view"] transcript-segment-view-model',
    '#segments-container > ytd-transcript-segment-renderer',
  ].join(', ');

  const TRANSCRIPT_BUTTON_MARKUP = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"></path>
      </svg>
      <span>Transcript</span>
    `;

  function extractModernTranscriptFallbackText(segmentNode, timestamp) {
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

  function readTranscriptEntriesFromSegmentNodes(segmentNodes) {
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

        const modernText =
          segmentNode.querySelector('span.yt-core-attributed-string[role="text"]')?.textContent?.trim() ||
          extractModernTranscriptFallbackText(segmentNode, modernTimestamp);

        return modernText ? [modernTimestamp, modernText] : null;
      })
      .filter((entry) => entry && entry[1]);
  }

  function isValidWatchContainer(element) {
    const hasActionButtons = element.querySelector(
      'button[aria-label*="like" i], button[aria-label*="Share" i], button[aria-label*="Save" i]'
    );
    const isInTitleArea = element.closest('#title, .title, ytd-video-primary-info-renderer #container');

    return Boolean(hasActionButtons) && !isInTitleArea;
  }

  function findSuitableButtonContainer(documentRef) {
    for (const selector of WATCH_CONTAINER_SELECTORS) {
      const element = documentRef.querySelector(selector);

      if (element && isValidWatchContainer(element)) {
        return element;
      }
    }

    for (const selector of SHORTS_CONTAINER_SELECTORS) {
      const element = documentRef.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function createTranscriptButton(documentRef, onClick) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'yt-transcript-extractor-btn';
    button.title = 'Get video transcript with one click';
    button.innerHTML = TRANSCRIPT_BUTTON_MARKUP;
    button.addEventListener('click', onClick);
    return button;
  }

  function updateButtonState(button, state) {
    if (!button) {
      return;
    }

    const label = button.querySelector('span');

    if (!label) {
      return;
    }

    if (state === 'loading') {
      label.textContent = 'Loading...';
      button.disabled = true;
      return;
    }

    label.textContent = 'Transcript';
    button.disabled = false;
  }

  function showUserNotification(documentRef, message, type = 'info') {
    const notification = documentRef.createElement('div');
    notification.className = `yt-transcript-notification yt-transcript-notification-${type}`;
    notification.textContent = message;
    documentRef.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (documentRef.body.contains(notification)) {
          documentRef.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  function waitForMilliseconds(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  function waitForSelector(documentRef, selector, timeout = 3000, MutationObserverCtor = MutationObserver) {
    return new Promise((resolve) => {
      if (documentRef.querySelector(selector)) {
        resolve(true);
        return;
      }

      const observer = new MutationObserverCtor(() => {
        if (documentRef.querySelector(selector)) {
          observer.disconnect();
          resolve(true);
        }
      });

      observer.observe(documentRef.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
    });
  }

  function isElementVisible(windowRef, element) {
    if (!element) {
      return false;
    }

    const style = windowRef.getComputedStyle(element);

    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    if (element.offsetWidth === 0 || element.offsetHeight === 0) {
      return false;
    }

    return element.offsetParent !== null;
  }

  function findTranscriptPanelButton(documentRef, isVisible) {
    for (const selector of TRANSCRIPT_PANEL_BUTTON_SELECTORS) {
      const button = documentRef.querySelector(selector);

      if (button && isVisible(button)) {
        return button;
      }
    }

    return null;
  }

  async function expandVideoDescription(documentRef, isVisible, wait) {
    for (const selector of DESCRIPTION_EXPAND_SELECTORS) {
      const button = documentRef.querySelector(selector);

      if (button && isVisible(button)) {
        button.click();
        await wait(300);
        return;
      }
    }
  }

  function getPageTitle(documentRef) {
    return (
      documentRef.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
      documentRef.querySelector('#title h1 yt-formatted-string')?.textContent?.trim() ||
      documentRef.querySelector('h1.title')?.textContent?.trim() ||
      'Unknown Title'
    );
  }

  return {
    TRANSCRIPT_SEGMENT_SELECTOR,
    createTranscriptButton,
    expandVideoDescription,
    extractModernTranscriptFallbackText,
    findSuitableButtonContainer,
    findTranscriptPanelButton,
    getPageTitle,
    isElementVisible,
    isValidWatchContainer,
    readTranscriptEntriesFromSegmentNodes,
    showUserNotification,
    updateButtonState,
    waitForMilliseconds,
    waitForSelector,
  };
});
