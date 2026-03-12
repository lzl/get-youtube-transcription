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

  const DEFAULT_BUTTON_TITLE = 'Get video transcript with one click';
  const TRANSCRIPT_ICON_PATH = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z';
  const SUCCESS_ICON_PATH = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';
  const NO_TRANSCRIPT_ICON_PATH = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h9.59L5 11.41 6.41 10 17 20.59V5H5v6.59L3.41 10 3 9.59V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10.59L19.59 14H19V5zm-6.59 9L14 13.59 12.59 15H7v-2h5.41z';
  const ERROR_ICON_PATH = 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';

  const TRANSCRIPT_BUTTON_MARKUP = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="${TRANSCRIPT_ICON_PATH}"></path>
      </svg>
      <span class="yt-transcript-button-label">Transcript</span>
      <span class="yt-transcript-button-status" aria-live="polite" aria-atomic="true"></span>
    `;

  const BUTTON_STATES = {
    normal: {
      label: 'Transcript',
      status: '',
      title: DEFAULT_BUTTON_TITLE,
      ariaLabel: DEFAULT_BUTTON_TITLE,
      iconPath: TRANSCRIPT_ICON_PATH,
      disabled: false,
    },
    loading: {
      label: 'Getting transcript...',
      status: 'Getting transcript...',
      title: 'Getting transcript...',
      ariaLabel: 'Getting transcript...',
      iconPath: TRANSCRIPT_ICON_PATH,
      disabled: true,
    },
    success: {
      label: 'Copied transcript',
      status: 'Transcript copied to clipboard',
      title: 'Transcript copied to clipboard',
      ariaLabel: 'Transcript copied to clipboard',
      iconPath: SUCCESS_ICON_PATH,
      disabled: false,
    },
    no_transcript: {
      label: 'No transcript',
      status: 'No transcript available',
      title: 'No transcript available',
      ariaLabel: 'No transcript available',
      iconPath: NO_TRANSCRIPT_ICON_PATH,
      disabled: false,
    },
    error: {
      label: 'Failed',
      status: 'Failed to get transcript',
      title: 'Failed to get transcript',
      ariaLabel: 'Failed to get transcript',
      iconPath: ERROR_ICON_PATH,
      disabled: false,
    },
  };

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

    return null;
  }

  function createTranscriptButton(documentRef, onClick) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'yt-transcript-extractor-btn';
    button.title = DEFAULT_BUTTON_TITLE;
    button.setAttribute('aria-label', DEFAULT_BUTTON_TITLE);
    button.dataset.state = 'normal';
    button.innerHTML = TRANSCRIPT_BUTTON_MARKUP;
    button.addEventListener('click', onClick);
    return button;
  }

  function updateButtonState(button, state) {
    if (!button) {
      return;
    }

    const label = button.querySelector('.yt-transcript-button-label') || button.querySelector('span');
    const status = button.querySelector('.yt-transcript-button-status');
    const iconPath = button.querySelector('svg path');
    const resolvedState = BUTTON_STATES[state] ? state : 'normal';
    const nextState = BUTTON_STATES[resolvedState];

    if (!label) {
      return;
    }

    label.textContent = nextState.label;
    button.disabled = nextState.disabled;
    button.dataset.state = resolvedState;
    button.title = nextState.title;
    button.setAttribute('aria-label', nextState.ariaLabel);

    if (status) {
      status.textContent = nextState.status;
    }

    if (iconPath) {
      iconPath.setAttribute('d', nextState.iconPath);
    }
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
    updateButtonState,
    waitForMilliseconds,
    waitForSelector,
  };
});
