function getApi(windowKey, modulePath) {
  if (typeof window !== 'undefined' && window[windowKey]) {
    return window[windowKey];
  }

  if (typeof require === 'function') {
    return require(modulePath);
  }

  return null;
}

function getTranscriptCoreApi() {
  return getApi('TranscriptCore', './transcript-core.js');
}

function getTranscriptDomApi() {
  return getApi('TranscriptContentDom', './content-dom.js');
}

function getTranscriptWorkflowApi() {
  return getApi('TranscriptContentWorkflow', './content-transcript.js');
}

function getListHoverActionsApi() {
  return getApi('TranscriptListHoverActions', './content-hover-actions.js');
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
  constructor() {
    this.transcriptButton = null;
    this.transcriptButtonRoot = null;
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
      resolvePageData: (html) => this.core.resolvePageData(html),
      getVideoIdFromUrl: (url) => this.core.getVideoIdFromUrl(url),
      getCurrentUrl: () => window.location.href,
      getPageTitle: () => this.getPageTitle(),
      waitForMilliseconds: (milliseconds) => this.waitForMilliseconds(milliseconds),
      findCaptionToggleButton: () => this.findCaptionToggleButton(),
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

    const removableRoot = this.getButtonRoot();

    if (removableRoot && document.contains(removableRoot)) {
      removableRoot.remove();
    }

    this.transcriptButton = null;
    this.transcriptButtonRoot = null;
  }

  getButtonRoot() {
    if (this.transcriptButtonRoot && document.contains(this.transcriptButtonRoot)) {
      return this.transcriptButtonRoot;
    }
    return this.transcriptButton;
  }

  startObservingButtonContainer(surface = this.getPageSurface()) {
    if (surface === 'other') {
      return;
    }

    this.attemptToAddButton(surface);
    this.setupContainerObserver();

    if (this.buttonCheckInterval) {
      clearInterval(this.buttonCheckInterval);
    }

    this.buttonCheckInterval = setInterval(() => {
      const currentSurface = this.getPageSurface();

      if (currentSurface === 'other') {
        return;
      }

      const buttonRoot = this.getButtonRoot();

      if (!buttonRoot || !document.contains(buttonRoot)) {
        this.transcriptButton = null;
        this.transcriptButtonRoot = null;
        this.attemptToAddButton(currentSurface);
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

  getPageSurface(url = window.location.href) {
    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.pathname === '/watch' || /^\/live\/[^/?]+/.test(parsedUrl.pathname)) {
        return 'watch_like';
      }

      if (/^\/shorts\/[^/?]+/.test(parsedUrl.pathname)) {
        return 'shorts';
      }
    } catch (error) {
      return 'other';
    }

    return 'other';
  }

  getVideoId(url = window.location.href) {
    return this.core.getVideoIdFromUrl(url);
  }

  handlePageChange(url = window.location.href) {
    const surface = this.getPageSurface(url);

    if (surface !== 'other') {
      this.listHoverController?.stop?.();
      this.startObservingButtonContainer(surface);
      return;
    }

    this.cleanupPreviousButton();
    this.listHoverController?.start?.();
  }

  findSuitableButtonContainer() {
    return this.dom.findSuitableButtonContainer(document);
  }

  findSuitableShortsActionBar() {
    return this.dom.findSuitableShortsActionBar(document);
  }

  findVisibleElement(documentRef, selectors, mode = 'first') {
    let result = null;

    for (const selector of selectors) {
      const matches = Array.from(documentRef?.querySelectorAll?.(selector) || []);

      for (const match of matches) {
        if (this.isElementVisible(match)) {
          if (mode === 'first') {
            return match;
          }

          result = match;
        }
      }
    }

    return result;
  }

  findCaptionToggleButton(documentRef = document) {
    return (
      this.findVisibleElement(documentRef, WATCH_CAPTION_TOGGLE_BUTTON_SELECTORS, 'first') ||
      this.findVisibleElement(documentRef, LIST_PREVIEW_CAPTION_TOGGLE_BUTTON_SELECTORS, 'last')
    );
  }

  isValidWatchContainer(element) {
    return this.dom.isValidWatchContainer(element);
  }

  attemptToAddButton(surface = this.getPageSurface()) {
    if (surface === 'other') {
      return;
    }

    const buttonRoot =
      this.transcriptButtonRoot && document.contains(this.transcriptButtonRoot)
        ? this.transcriptButtonRoot
        : this.transcriptButton;

    if (buttonRoot && document.contains(buttonRoot)) {
      return;
    }

    const container = surface === 'watch_like'
      ? this.findSuitableButtonContainer()
      : this.findSuitableShortsActionBar();

    if (container) {
      this.createAndInsertButton(container, surface);
    }
  }

  createAndInsertButton(targetContainer, surface = 'watch_like') {
    const buttonRoot = this.getButtonRoot();

    if (buttonRoot && document.contains(buttonRoot)) {
      return;
    }

    if (surface === 'shorts') {
      this.createAndInsertShortsButton(targetContainer);
      return;
    }

    const button = this.dom.createTranscriptButton(document, () => {
      void this.handleTranscriptButtonClick(button);
    });

    targetContainer.appendChild(button);
    this.transcriptButton = button;
    this.transcriptButtonRoot = button;
  }

  createAndInsertShortsButton(targetContainer) {
    let shortsButton = null;
    const shortsAction = this.dom.createShortsTranscriptButton(document, targetContainer, () => {
      void this.handleTranscriptButtonClick(shortsButton);
    });

    if (!shortsAction?.root || !shortsAction.button) {
      return;
    }

    shortsButton = shortsAction.button;
    if (typeof this.dom.insertShortsTranscriptButton === 'function') {
      this.dom.insertShortsTranscriptButton(targetContainer, shortsAction.root);
    } else {
      targetContainer.appendChild(shortsAction.root);
    }
    this.transcriptButton = shortsAction.button;
    this.transcriptButtonRoot = shortsAction.root;
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
      button: buttonElement,
      displayUrl: watchUrl,
      sourceUrl: watchUrl,
      updateState: (state) => this.dom.updateHoverButtonState(buttonElement, state),
    });
  }

  async runTranscriptAction({
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

  async fetchInnerTubeTranscript(html, videoId) {
    return this.workflow.fetchInnerTubeTranscript(html, videoId);
  }

  async capturePotToken(videoId) {
    return this.workflow.capturePotToken(videoId);
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
    if (this.transcriptButtonRoot?.getAttribute?.('data-yt-shorts-transcript-button') === 'true') {
      this.dom.updateShortsButtonState(this.transcriptButton, state);
      return;
    }

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
