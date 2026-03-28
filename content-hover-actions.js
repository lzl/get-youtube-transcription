(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TranscriptListHoverActions = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getTranscriptDomApi() {
    if (typeof globalThis !== 'undefined' && globalThis.TranscriptContentDom) {
      return globalThis.TranscriptContentDom;
    }

    if (typeof require === 'function') {
      return require('./content-dom.js');
    }

    return null;
  }

  const transcriptDomApi = getTranscriptDomApi();
  const LIST_CARD_SELECTOR = 'ytd-rich-item-renderer';
  const WATCH_LINK_SELECTOR = 'a[href*="/watch"]';
  const HOVER_BUTTON_SELECTOR = 'ytd-thumbnail-overlay-toggle-button-renderer';
  const MODERN_PREVIEW_CONTROLS_SELECTOR =
    'yt-inline-player-controls .ytInlinePlayerControlsTopRightControls';
  const MODERN_PREVIEW_FALLBACK_SELECTOR = '.ytInlinePlayerControlsTopRightControls';
  const MODERN_PREVIEW_BUTTON_TEMPLATE_SELECTOR =
    '.ytInlinePlayerControlsTopRightControlsCircleButton';
  const INJECTED_BUTTON_ATTR = 'data-yt-list-transcript-button';
  const MODERN_PLAYER_BUTTON_CLASS = 'yt-list-transcript-player-button';
  const LIST_HOVER_BUTTON_LABEL = 'Copy transcript';
  const TRANSCRIPT_ICON_PATH =
    transcriptDomApi?.TRANSCRIPT_ICON_PATH ||
    'M7 4.5h10A2.5 2.5 0 0 1 19.5 7v2.25L16.75 12l2.75 2.75V17A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Zm1.25 4H14a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Zm0 3.5H15.5a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Zm0 3.5H13a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Z';

  function isWatchPage(locationRef) {
    return locationRef?.pathname === '/watch';
  }

  function getListCards(documentRef) {
    if (!documentRef?.querySelectorAll) {
      return [];
    }

    return Array.from(documentRef.querySelectorAll(LIST_CARD_SELECTOR));
  }

  function getQueryMatches(root, selector) {
    if (!root?.querySelectorAll) {
      return [];
    }

    return Array.from(root.querySelectorAll(selector));
  }

  function toCanonicalWatchUrl(href, origin) {
    if (!href) {
      return null;
    }

    try {
      const parsedUrl = new URL(href, origin || 'https://www.youtube.com');
      const videoId = parsedUrl.searchParams.get('v');

      if (parsedUrl.pathname !== '/watch' || !videoId) {
        return null;
      }

      return `https://www.youtube.com/watch?v=${videoId}`;
    } catch (error) {
      return null;
    }
  }

  function getCardWatchUrl(card, windowRef) {
    const link =
      card?.querySelector?.('a#thumbnail[href*="/watch"]') ||
      card?.querySelector?.('a[href*="/watch?v="]') ||
      card?.querySelector?.(WATCH_LINK_SELECTOR);
    const href = link?.href || link?.getAttribute?.('href') || '';

    return toCanonicalWatchUrl(href, windowRef?.location?.origin);
  }

  function getNativeHoverButtons(card) {
    return Array.from(card?.querySelectorAll?.(HOVER_BUTTON_SELECTOR) || []).filter((buttonWrapper) => {
      return buttonWrapper?.getAttribute?.(INJECTED_BUTTON_ATTR) !== 'true';
    });
  }

  function hasInjectedButton(card) {
    const directMatch = card?.querySelector?.(`[${INJECTED_BUTTON_ATTR}="true"]`);

    if (directMatch) {
      return true;
    }

    return Array.from(card?.querySelectorAll?.(HOVER_BUTTON_SELECTOR) || []).some((buttonWrapper) => {
      return buttonWrapper?.getAttribute?.(INJECTED_BUTTON_ATTR) === 'true';
    });
  }

  function updateTooltip(wrapper, text = LIST_HOVER_BUTTON_LABEL) {
    const tooltip =
      wrapper?.querySelector?.('#tooltip, tp-yt-paper-tooltip #tooltip, yt-formatted-string') ||
      wrapper?.querySelector?.('#tooltip') ||
      wrapper?.querySelector?.('yt-formatted-string');

    if (tooltip) {
      tooltip.textContent = text;
    }
  }

  function configureListHoverButton(button, wrapper) {
    if (!button) {
      return;
    }

    button._ytTranscriptNormalTitle = LIST_HOVER_BUTTON_LABEL;
    button._ytTranscriptNormalAriaLabel = LIST_HOVER_BUTTON_LABEL;
    button.setAttribute?.('title', LIST_HOVER_BUTTON_LABEL);
    button.setAttribute?.('aria-label', LIST_HOVER_BUTTON_LABEL);
    button.title = LIST_HOVER_BUTTON_LABEL;
    button.ariaLabel = LIST_HOVER_BUTTON_LABEL;
    updateTooltip(wrapper, LIST_HOVER_BUTTON_LABEL);
  }

  function handleListHoverButtonClick(event, button, buttonKind, watchUrl, onTranscriptButtonClick) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!watchUrl) {
      return;
    }

    onTranscriptButtonClick?.({
      buttonElement: button,
      buttonKind,
      watchUrl,
    });
  }

  function createTranscriptButtonWrapper(templateWrapper, canonicalUrl, onTranscriptButtonClick) {
    const wrapper = templateWrapper?.cloneNode?.(true);
    const button = wrapper?.querySelector?.('button');
    const iconPath = wrapper?.querySelector?.('svg path');

    if (!wrapper || !button || !iconPath) {
      return null;
    }

    wrapper.setAttribute?.(INJECTED_BUTTON_ATTR, 'true');
    wrapper.className = `${wrapper.className || ''} ${MODERN_PLAYER_BUTTON_CLASS}`.trim();
    wrapper.removeAttribute?.('command');
    wrapper.removeAttribute?.('command-target');
    wrapper.removeAttribute?.('target-id');
    button.removeAttribute?.('command');
    button.removeAttribute?.('command-target');
    button.removeAttribute?.('target-id');
    button.removeAttribute?.('href');
    button.type = 'button';
    configureListHoverButton(button, wrapper);
    iconPath.setAttribute?.('d', TRANSCRIPT_ICON_PATH);
    button.addEventListener?.('click', (event) => {
      handleListHoverButtonClick(event, button, 'native', canonicalUrl, onTranscriptButtonClick);
    });

    return wrapper;
  }

  function createSvgElement(documentRef, tagName) {
    if (documentRef?.createElementNS) {
      return documentRef.createElementNS('http://www.w3.org/2000/svg', tagName);
    }

    return documentRef?.createElement?.(tagName) || null;
  }

  function configureModernWrapper(wrapper, button, iconPath, getCurrentWatchUrl, onTranscriptButtonClick) {
    wrapper.setAttribute?.(INJECTED_BUTTON_ATTR, 'true');
    wrapper.className = `${wrapper.className || ''} ${MODERN_PLAYER_BUTTON_CLASS}`.trim();
    button.type = 'button';
    configureListHoverButton(button, wrapper);
    iconPath.setAttribute?.('d', TRANSCRIPT_ICON_PATH);
    button.addEventListener?.('click', (event) => {
      handleListHoverButtonClick(event, button, 'modern', getCurrentWatchUrl?.(), onTranscriptButtonClick);
    });
  }

  function createModernPlayerButton(documentRef, templateButton, getCurrentWatchUrl, onTranscriptButtonClick) {
    if (templateButton?.cloneNode) {
      const wrapper = templateButton.cloneNode(true);
      const button = wrapper?.querySelector?.('button');
      const iconPath = wrapper?.querySelector?.('svg path');

      if (wrapper && button && iconPath) {
        button.removeAttribute?.('aria-pressed');
        configureModernWrapper(wrapper, button, iconPath, getCurrentWatchUrl, onTranscriptButtonClick);
        return wrapper;
      }
    }

    const createElement = documentRef?.createElement?.bind(documentRef);

    if (!createElement) {
      return null;
    }

    const wrapper = createElement('div');
    const iconContainer = createElement('div');
    const button = createElement('button');
    const icon = createSvgElement(documentRef, 'svg');
    const path = createSvgElement(documentRef, 'path');

    if (!wrapper || !iconContainer || !button || !icon || !path) {
      return null;
    }

    wrapper.className = `ytInlinePlayerControlsTopRightControlsCircleButton`;
    iconContainer.className = 'ytInlinePlayerControlsButtonIcon';
    button.className = 'ytmMuteButtonButton';
    icon.setAttribute?.('viewBox', '0 0 24 24');
    icon.setAttribute?.('aria-hidden', 'true');
    icon.appendChild?.(path);
    button.appendChild?.(icon);
    iconContainer.appendChild?.(button);
    wrapper.appendChild?.(iconContainer);
    configureModernWrapper(wrapper, button, path, getCurrentWatchUrl, onTranscriptButtonClick);

    return wrapper;
  }

  function findHoverButtonContainer(card, nativeButtons) {
    const lastNativeButton = nativeButtons[nativeButtons.length - 1];
    return lastNativeButton?.parentNode || lastNativeButton?.parentElement || card?.toolbar || null;
  }

  function hasInjectedModernPlayerButton(controlsContainer) {
    return Boolean(
      controlsContainer?.querySelector?.(
        `[${INJECTED_BUTTON_ATTR}="true"].${MODERN_PLAYER_BUTTON_CLASS}`
      )
    );
  }

  function findModernPreviewControlsContainer(documentRef, card) {
    const candidates = [
      ...getQueryMatches(card, MODERN_PREVIEW_CONTROLS_SELECTOR),
      ...getQueryMatches(card, MODERN_PREVIEW_FALLBACK_SELECTOR),
      ...getQueryMatches(documentRef, MODERN_PREVIEW_CONTROLS_SELECTOR),
      ...getQueryMatches(documentRef, MODERN_PREVIEW_FALLBACK_SELECTOR),
    ];
    const uniqueCandidates = [];
    const seenCandidates = new Set();

    for (const candidate of candidates) {
      if (!candidate?.appendChild || seenCandidates.has(candidate)) {
        continue;
      }

      seenCandidates.add(candidate);
      uniqueCandidates.push(candidate);
    }

    for (let index = uniqueCandidates.length - 1; index >= 0; index -= 1) {
      if (!hasInjectedModernPlayerButton(uniqueCandidates[index])) {
        return uniqueCandidates[index];
      }
    }

    const controlsContainer = uniqueCandidates[uniqueCandidates.length - 1] || null;

    if (!controlsContainer?.appendChild) {
      return null;
    }

    return controlsContainer;
  }

  function findModernPreviewButtonTemplate(controlsContainer) {
    const templateButton = controlsContainer?.querySelector?.(MODERN_PREVIEW_BUTTON_TEMPLATE_SELECTOR);

    if (!templateButton?.cloneNode) {
      return null;
    }

    return templateButton;
  }

  function createListHoverUrlController({
    documentRef,
    windowRef,
    locationRef,
    MutationObserverCtor,
    onTranscriptButtonClick,
    setTimeoutFn = typeof setTimeout === 'function' ? setTimeout : null,
    clearTimeoutFn = typeof clearTimeout === 'function' ? clearTimeout : null,
  }) {
    let observer = null;
    let currentHoveredWatchUrl = null;
    let currentHoveredCard = null;
    let pendingPreviewRefreshTimeout = null;
    let pendingPreviewSeed = null;
    const trackedCards = new Set();

    function shouldContinueModernPreviewRefresh() {
      const latestControlsContainer = findModernPreviewControlsContainer(documentRef, currentHoveredCard);

      if (!latestControlsContainer) {
        return true;
      }

      if (!hasInjectedModernPlayerButton(latestControlsContainer)) {
        return true;
      }

      return Boolean(
        pendingPreviewSeed?.hadInjectedButton &&
          pendingPreviewSeed?.controlsContainer &&
          latestControlsContainer === pendingPreviewSeed.controlsContainer
      );
    }

    function scheduleModernPreviewRefresh(attemptsRemaining = 12) {
      if (!setTimeoutFn || attemptsRemaining <= 0) {
        return;
      }

      if (pendingPreviewRefreshTimeout && clearTimeoutFn) {
        clearTimeoutFn(pendingPreviewRefreshTimeout);
      }

      pendingPreviewRefreshTimeout = setTimeoutFn(() => {
        pendingPreviewRefreshTimeout = null;
        refresh();

        if (shouldContinueModernPreviewRefresh()) {
          scheduleModernPreviewRefresh(attemptsRemaining - 1);
        }
      }, 120);
    }

    function bindModernPreviewTracking(card) {
      if (!card?.addEventListener || trackedCards.has(card)) {
        return;
      }

      const updateCurrentWatchUrl = () => {
        const nextWatchUrl = getCardWatchUrl(card, windowRef) || currentHoveredWatchUrl;
        const seedControlsContainer = findModernPreviewControlsContainer(documentRef, card);
        const urlChanged = nextWatchUrl !== currentHoveredWatchUrl;

        currentHoveredCard = card;
        currentHoveredWatchUrl = nextWatchUrl;
        pendingPreviewSeed = {
          controlsContainer: seedControlsContainer,
          hadInjectedButton: hasInjectedModernPlayerButton(seedControlsContainer),
        };

        if (!urlChanged && pendingPreviewSeed.hadInjectedButton) {
          return;
        }

        scheduleModernPreviewRefresh();
      };

      trackedCards.add(card);
      card.addEventListener('mouseenter', updateCurrentWatchUrl);
      card.addEventListener('mouseover', updateCurrentWatchUrl);
      card.addEventListener('focusin', updateCurrentWatchUrl);
    }

    function injectIntoCard(card) {
      if (!card) {
        return;
      }

      const canonicalUrl = getCardWatchUrl(card, windowRef);

      if (!canonicalUrl) {
        return;
      }

      const nativeButtons = getNativeHoverButtons(card);

      if (nativeButtons.length > 0) {
        if (hasInjectedButton(card)) {
          return;
        }

        const buttonContainer = findHoverButtonContainer(card, nativeButtons);

        if (!buttonContainer?.appendChild) {
          return;
        }

        const injectedWrapper = createTranscriptButtonWrapper(
          nativeButtons[0],
          canonicalUrl,
          onTranscriptButtonClick
        );

        if (!injectedWrapper) {
          return;
        }

        buttonContainer.appendChild(injectedWrapper);
        return;
      }

      bindModernPreviewTracking(card);

      const modernControlsContainer = findModernPreviewControlsContainer(documentRef, card);

      if (!modernControlsContainer) {
        return;
      }

      if (hasInjectedModernPlayerButton(modernControlsContainer)) {
        return;
      }

        const modernButton = createModernPlayerButton(
          documentRef,
          findModernPreviewButtonTemplate(modernControlsContainer),
          () => currentHoveredWatchUrl || canonicalUrl,
          onTranscriptButtonClick
        );

      if (!modernButton) {
        return;
      }

      modernControlsContainer.appendChild(modernButton);
    }

    function refresh() {
      if (isWatchPage(locationRef)) {
        return;
      }

      for (const card of getListCards(documentRef)) {
        injectIntoCard(card);
      }
    }

    function start() {
      refresh();

      if (observer || !MutationObserverCtor) {
        return;
      }

      observer = new MutationObserverCtor(() => {
        refresh();
      });

      observer.observe(documentRef?.body || documentRef, {
        childList: true,
        subtree: true,
      });
    }

    function stop() {
      if (pendingPreviewRefreshTimeout && clearTimeoutFn) {
        clearTimeoutFn(pendingPreviewRefreshTimeout);
        pendingPreviewRefreshTimeout = null;
      }

      pendingPreviewSeed = null;
      currentHoveredCard = null;
      currentHoveredWatchUrl = null;
      trackedCards.clear();

      if (!observer) {
        return;
      }

      observer.disconnect?.();
      observer = null;
    }

    return {
      TRANSCRIPT_ICON_PATH,
      refresh,
      start,
      stop,
    };
  }

  return {
    BUTTON_LABEL: LIST_HOVER_BUTTON_LABEL,
    LIST_CARD_SELECTOR,
    HOVER_BUTTON_SELECTOR,
    INJECTED_BUTTON_ATTR,
    TRANSCRIPT_ICON_PATH,
    createListHoverUrlController,
  };
});
