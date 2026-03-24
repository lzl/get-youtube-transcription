function getTranscriptCoreApi() {
  if (typeof window !== 'undefined' && window.TranscriptCore) {
    return window.TranscriptCore;
  }

  if (typeof require === 'function') {
    return require('./transcript-core.js');
  }

  return null;
}

function getTranscriptDomApi() {
  if (typeof window !== 'undefined' && window.TranscriptContentDom) {
    return window.TranscriptContentDom;
  }

  if (typeof require === 'function') {
    return require('./content-dom.js');
  }

  return null;
}

function getTranscriptWorkflowApi() {
  if (typeof window !== 'undefined' && window.TranscriptContentWorkflow) {
    return window.TranscriptContentWorkflow;
  }

  if (typeof require === 'function') {
    return require('./content-transcript.js');
  }

  return null;
}

function getListHoverActionsApi() {
  if (typeof window !== 'undefined' && window.TranscriptListHoverActions) {
    return window.TranscriptListHoverActions;
  }

  if (typeof require === 'function') {
    return require('./content-hover-actions.js');
  }

  return null;
}

const SUCCESS_BUTTON_FEEDBACK_MS = 1800;
const ERROR_BUTTON_FEEDBACK_MS = 3000;
const NO_TRANSCRIPT_ERROR_MESSAGE = 'No captions found';
const WATCH_CAPTION_TOGGLE_BUTTON_SELECTORS = [
  '#movie_player button.ytp-subtitles-button',
  '#movie_player .ytp-right-controls-left button.ytp-subtitles-button',
];
const LIST_PREVIEW_CAPTION_TOGGLE_BUTTON_SELECTORS = [
  '.ytInlinePlayerControlsTopRightControls .ytmClosedCaptioningButtonButton',
];

class YoutubeTranscriptionExtension {
  static readTranscriptEntriesFromSegmentNodes(segmentNodes) {
    return getTranscriptDomApi().readTranscriptEntriesFromSegmentNodes(segmentNodes);
  }

  static extractModernTranscriptFallbackText(segmentNode, timestamp) {
    return getTranscriptDomApi().extractModernTranscriptFallbackText(segmentNode, timestamp);
  }

  constructor() {
    this.transcriptButton = null;
    this.isExtracting = false;
    this.containerObserver = null;
    this.buttonCheckInterval = null;
    this.buttonStateResetTimeout = null;
    this.potTokens = new Map();
    this.dom = getTranscriptDomApi();
    this.core = getTranscriptCoreApi();
    this.workflow = null;
    this.listHoverController = null;

    this.initializeExtension();
  }

  initializeExtension() {
    if (!this.core || !this.dom) {
      console.error('Transcript extension dependencies are not available');
      return;
    }

    this.workflow = getTranscriptWorkflowApi().createTranscriptWorkflow({
      TranscriptCore: this.core,
      documentRef: document,
      navigatorRef: navigator,
      performanceRef: performance,
      potTokens: this.potTokens,
      readTranscriptEntriesFromSegmentNodes: YoutubeTranscriptionExtension.readTranscriptEntriesFromSegmentNodes,
      resolvePageData: (html) => this.core.resolvePageData(html),
      getVideoIdFromUrl: (url) => this.core.getVideoIdFromUrl(url),
      getCurrentUrl: () => window.location.href,
      getPageTitle: () => this.getPageTitle(),
      waitForMilliseconds: (milliseconds) => this.waitForMilliseconds(milliseconds),
      waitForSelector: (selector, timeout) => this.waitForSelector(selector, timeout),
      findCaptionToggleButton: () => this.findCaptionToggleButton(),
      findTranscriptPanelButton: async () => this.findTranscriptPanelButton(),
      transcriptSegmentSelector: this.dom.TRANSCRIPT_SEGMENT_SELECTOR,
    });

    const listHoverActionsApi = getListHoverActionsApi();

    if (listHoverActionsApi?.createListHoverUrlController) {
      this.listHoverController = listHoverActionsApi.createListHoverUrlController({
        documentRef: document,
        windowRef: window,
        locationRef: window.location,
        MutationObserverCtor: MutationObserver,
        onTranscriptButtonClick: ({ buttonElement, watchUrl }) => {
          void this.handleListHoverTranscriptButtonClick({
            buttonElement,
            watchUrl,
          });
        },
      });
    }

    this.setupGlobalDebugTool();
    this.observePageNavigation();
    this.handlePageChange(window.location.href);
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
      this.handlePageChange(currentUrl);
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

    this.clearButtonStateResetTimeout();

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

  isYoutubeVideoPage(url = window.location.href) {
    return Boolean(this.getVideoId(url));
  }

  getVideoId(url = window.location.href) {
    return this.core.getVideoIdFromUrl(url);
  }

  handlePageChange(url = window.location.href) {
    if (this.isYoutubeVideoPage(url)) {
      this.listHoverController?.stop?.();
      this.startObservingButtonContainer();
      return;
    }

    this.cleanupPreviousButton();
    this.listHoverController?.start?.();
  }

  findSuitableButtonContainer() {
    return this.dom.findSuitableButtonContainer(document);
  }

  findFirstVisibleElement(documentRef, selectors) {
    for (const selector of selectors) {
      const matches = Array.from(documentRef?.querySelectorAll?.(selector) || []);

      for (const match of matches) {
        if (this.isElementVisible(match)) {
          return match;
        }
      }
    }

    return null;
  }

  findLastVisibleElement(documentRef, selectors) {
    let lastVisibleElement = null;

    for (const selector of selectors) {
      const matches = Array.from(documentRef?.querySelectorAll?.(selector) || []);

      for (const match of matches) {
        if (this.isElementVisible(match)) {
          lastVisibleElement = match;
        }
      }
    }

    return lastVisibleElement;
  }

  findCaptionToggleButton(documentRef = document) {
    return (
      this.findFirstVisibleElement(documentRef, WATCH_CAPTION_TOGGLE_BUTTON_SELECTORS) ||
      this.findLastVisibleElement(documentRef, LIST_PREVIEW_CAPTION_TOGGLE_BUTTON_SELECTORS)
    );
  }

  isValidWatchContainer(element) {
    return this.dom.isValidWatchContainer(element);
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

    const button = this.dom.createTranscriptButton(document, () => {
      void this.handleTranscriptButtonClick(button);
    });

    targetContainer.appendChild(button);
    this.transcriptButton = button;
  }

  isMainActionTarget(button) {
    return !button || button === this.transcriptButton;
  }

  getActionState(button) {
    if (this.isMainActionTarget(button)) {
      return {
        isExtracting: this.isExtracting,
        resetTimeout: this.buttonStateResetTimeout,
      };
    }

    if (!button._ytTranscriptActionState) {
      button._ytTranscriptActionState = {
        isExtracting: false,
        resetTimeout: null,
      };
    }

    return button._ytTranscriptActionState;
  }

  setActionState(button, patch) {
    if (this.isMainActionTarget(button)) {
      if (Object.prototype.hasOwnProperty.call(patch, 'isExtracting')) {
        this.isExtracting = patch.isExtracting;
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'resetTimeout')) {
        this.buttonStateResetTimeout = patch.resetTimeout;
      }

      return;
    }

    Object.assign(this.getActionState(button), patch);
  }

  async handleTranscriptButtonClick(button = null) {
    return this.runTranscriptAction({
      button,
      updateState: (state) => this.updateButtonState(state),
    });
  }

  async handleListHoverTranscriptButtonClick({ buttonElement, watchUrl }) {
    return this.runTranscriptAction({
      allowPanelFallback: false,
      button: buttonElement,
      displayUrl: watchUrl,
      sourceUrl: watchUrl,
      updateState: (state) => this.dom.updateHoverButtonState(buttonElement, state),
    });
  }

  async runTranscriptAction({
    allowPanelFallback,
    button = null,
    displayUrl,
    sourceUrl,
    updateState,
  }) {
    const actionState = this.getActionState(button);

    if (actionState.isExtracting) {
      return;
    }

    this.clearButtonStateResetTimeout(button);
    this.setActionState(button, { isExtracting: true });
    updateState('loading');

    try {
      const transcriptPackage = await this.extractTranscriptPackage({
        allowPanelFallback,
        displayUrl,
        sourceUrl,
      });
      await this.copyTextToClipboard(transcriptPackage);
      this.showTemporaryButtonState(button, updateState, 'success', SUCCESS_BUTTON_FEEDBACK_MS);
    } catch (error) {
      console.error('Transcript extraction failed:', error);
      this.showTemporaryButtonState(
        button,
        updateState,
        this.getFeedbackStateForError(error),
        ERROR_BUTTON_FEEDBACK_MS
      );
    } finally {
      this.setActionState(button, { isExtracting: false });
    }
  }

  async extractTranscriptPackage(options = {}) {
    return this.workflow.extractTranscriptPackage(options);
  }

  getTranscriptSourceUrl() {
    return this.workflow.getTranscriptSourceUrl();
  }

  async fetchHtml(url) {
    return this.workflow.fetchHtml(url);
  }

  async fetchTimedTextTranscript(playerResponse, videoId) {
    return this.workflow.fetchTimedTextTranscript(playerResponse, videoId);
  }

  async capturePotToken(videoId) {
    return this.workflow.capturePotToken(videoId);
  }

  async fetchTranscriptFromPanel() {
    return this.workflow.fetchTranscriptFromPanel();
  }

  async findTranscriptPanelButton() {
    await this.expandVideoDescription();
    return this.dom.findTranscriptPanelButton(document, (element) => this.isElementVisible(element));
  }

  async expandVideoDescription() {
    return this.dom.expandVideoDescription(
      document,
      (element) => this.isElementVisible(element),
      (milliseconds) => this.waitForMilliseconds(milliseconds)
    );
  }

  formatTranscriptText(entries) {
    return this.workflow.formatTranscriptText(entries);
  }

  getPageTitle() {
    return this.dom.getPageTitle(document);
  }

  async copyTextToClipboard(transcriptPackage) {
    return this.workflow.copyTextToClipboard(transcriptPackage);
  }

  updateButtonState(state) {
    this.dom.updateButtonState(this.transcriptButton, state);
  }

  showTemporaryButtonState(button, updateState, state, duration) {
    updateState(state);
    const timeout = setTimeout(() => {
      this.setActionState(button, { resetTimeout: null });

      if (!this.getActionState(button).isExtracting) {
        updateState('normal');
      }
    }, duration);

    this.setActionState(button, { resetTimeout: timeout });
  }

  clearButtonStateResetTimeout(button = null) {
    const { resetTimeout } = this.getActionState(button);

    if (!resetTimeout) {
      return;
    }

    clearTimeout(resetTimeout);
    this.setActionState(button, { resetTimeout: null });
  }

  getFeedbackStateForError(error) {
    if ((error?.message || '').includes(NO_TRANSCRIPT_ERROR_MESSAGE)) {
      return 'no_transcript';
    }

    return 'error';
  }

  waitForMilliseconds(milliseconds) {
    return this.dom.waitForMilliseconds(milliseconds);
  }

  waitForSelector(selector, timeout = 3000) {
    return this.dom.waitForSelector(document, selector, timeout);
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
    return this.dom.isElementVisible(window, element);
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
        pageData = this.core.resolvePageData(html);
      } catch (error) {
        pageData = { error: error.message };
      }

      try {
        playerResponse = this.core.extractJsonBlob(html, 'ytInitialPlayerResponse');
      } catch (error) {
        playerResponse = null;
      }

      return {
        sourceUrl,
        pageData,
        captionBaseUrl: this.core.getCaptionBaseUrl(playerResponse),
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
