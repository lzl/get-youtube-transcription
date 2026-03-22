(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TranscriptHomeHoverActions = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HOME_CARD_SELECTOR = 'ytd-rich-grid-renderer ytd-rich-item-renderer';
  const WATCH_LINK_SELECTOR = 'a[href*="/watch"]';
  const HOVER_BUTTON_SELECTOR = 'ytd-thumbnail-overlay-toggle-button-renderer';
  const MODERN_PREVIEW_PLAYER_SELECTOR = '#inline-preview-player';
  const MODERN_PREVIEW_CONTROLS_SELECTOR =
    'yt-inline-player-controls .ytInlinePlayerControlsTopRightControls';
  const MODERN_PREVIEW_FALLBACK_SELECTOR = '.ytInlinePlayerControlsTopRightControls';
  const MODERN_PREVIEW_BUTTON_TEMPLATE_SELECTOR =
    '.ytInlinePlayerControlsTopRightControlsCircleButton';
  const INJECTED_BUTTON_ATTR = 'data-yt-home-url-logger';
  const MODERN_PLAYER_BUTTON_CLASS = 'yt-home-url-logger-player-button';
  const BUTTON_LABEL = 'Log video URL';
  const URL_LOG_ICON_PATH =
    'M3.9 12a5 5 0 0 1 5-5h3v2h-3a3 3 0 1 0 0 6h3v2h-3a5 5 0 0 1-5-5Zm7-1h2v2h-2v-2Zm4.2-4h-3v2h3a3 3 0 1 1 0 6h-3v2h3a5 5 0 1 0 0-10Z';

  function isHomePage(locationRef) {
    return locationRef?.pathname === '/';
  }

  function getHomeCards(documentRef) {
    if (!documentRef?.querySelectorAll) {
      return [];
    }

    return Array.from(documentRef.querySelectorAll(HOME_CARD_SELECTOR));
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

  function updateTooltip(wrapper) {
    const tooltip =
      wrapper?.querySelector?.('#tooltip, tp-yt-paper-tooltip #tooltip, yt-formatted-string') ||
      wrapper?.querySelector?.('#tooltip') ||
      wrapper?.querySelector?.('yt-formatted-string');

    if (tooltip) {
      tooltip.textContent = BUTTON_LABEL;
    }
  }

  function createLogButtonWrapper(templateWrapper, canonicalUrl, consoleRef) {
    const wrapper = templateWrapper?.cloneNode?.(true);
    const button = wrapper?.querySelector?.('button');
    const iconPath = wrapper?.querySelector?.('svg path');

    if (!wrapper || !button || !iconPath) {
      return null;
    }

    wrapper.setAttribute?.(INJECTED_BUTTON_ATTR, 'true');
    wrapper.removeAttribute?.('command');
    wrapper.removeAttribute?.('command-target');
    wrapper.removeAttribute?.('target-id');
    button.removeAttribute?.('command');
    button.removeAttribute?.('command-target');
    button.removeAttribute?.('target-id');
    button.removeAttribute?.('href');
    button.type = 'button';
    button.setAttribute?.('title', BUTTON_LABEL);
    button.setAttribute?.('aria-label', BUTTON_LABEL);
    button.title = BUTTON_LABEL;
    button.ariaLabel = BUTTON_LABEL;
    iconPath.setAttribute?.('d', URL_LOG_ICON_PATH);
    updateTooltip(wrapper);
    button.addEventListener?.('click', (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      consoleRef?.log?.(canonicalUrl);
    });

    return wrapper;
  }

  function createSvgElement(documentRef, tagName) {
    if (documentRef?.createElementNS) {
      return documentRef.createElementNS('http://www.w3.org/2000/svg', tagName);
    }

    return documentRef?.createElement?.(tagName) || null;
  }

  function createModernPlayerButton(documentRef, templateButton, getCurrentWatchUrl, consoleRef) {
    if (templateButton?.cloneNode) {
      const wrapper = templateButton.cloneNode(true);
      const button = wrapper?.querySelector?.('button');
      const iconPath = wrapper?.querySelector?.('svg path');

      if (wrapper && button && iconPath) {
        wrapper.setAttribute?.(INJECTED_BUTTON_ATTR, 'true');
        wrapper.className = `${wrapper.className || ''} ${MODERN_PLAYER_BUTTON_CLASS}`.trim();
        button.removeAttribute?.('aria-pressed');
        button.type = 'button';
        button.setAttribute?.('title', BUTTON_LABEL);
        button.setAttribute?.('aria-label', BUTTON_LABEL);
        button.title = BUTTON_LABEL;
        button.ariaLabel = BUTTON_LABEL;
        iconPath.setAttribute?.('d', URL_LOG_ICON_PATH);
        button.addEventListener?.('click', (event) => {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          const currentWatchUrl = getCurrentWatchUrl?.();

          if (!currentWatchUrl) {
            return;
          }

          consoleRef?.log?.(currentWatchUrl);
        });

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

    wrapper.setAttribute?.(INJECTED_BUTTON_ATTR, 'true');
    wrapper.className = `ytInlinePlayerControlsTopRightControlsCircleButton ${MODERN_PLAYER_BUTTON_CLASS}`;
    iconContainer.className = 'ytInlinePlayerControlsButtonIcon';
    button.className = 'ytmMuteButtonButton';
    button.type = 'button';
    button.setAttribute?.('title', BUTTON_LABEL);
    button.setAttribute?.('aria-label', BUTTON_LABEL);
    button.title = BUTTON_LABEL;
    button.ariaLabel = BUTTON_LABEL;
    icon.setAttribute?.('viewBox', '0 0 24 24');
    icon.setAttribute?.('aria-hidden', 'true');
    path.setAttribute?.('d', URL_LOG_ICON_PATH);
    icon.appendChild?.(path);
    button.appendChild?.(icon);
    iconContainer.appendChild?.(button);
    wrapper.appendChild?.(iconContainer);
    button.addEventListener?.('click', (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const currentWatchUrl = getCurrentWatchUrl?.();

      if (!currentWatchUrl) {
        return;
      }

      consoleRef?.log?.(currentWatchUrl);
    });

    return wrapper;
  }

  function findHoverButtonContainer(card, nativeButtons) {
    const lastNativeButton = nativeButtons[nativeButtons.length - 1];
    return lastNativeButton?.parentNode || lastNativeButton?.parentElement || card?.toolbar || null;
  }

  function findModernPreviewControlsContainer(documentRef, card) {
    const previewPlayer = documentRef?.querySelector?.(MODERN_PREVIEW_PLAYER_SELECTOR);
    const controlsContainer =
      documentRef?.querySelector?.(MODERN_PREVIEW_CONTROLS_SELECTOR) ||
      documentRef?.querySelector?.(MODERN_PREVIEW_FALLBACK_SELECTOR) ||
      previewPlayer?.querySelector?.(MODERN_PREVIEW_CONTROLS_SELECTOR) ||
      previewPlayer?.querySelector?.(MODERN_PREVIEW_FALLBACK_SELECTOR) ||
      card?.querySelector?.(MODERN_PREVIEW_CONTROLS_SELECTOR) ||
      card?.querySelector?.(MODERN_PREVIEW_FALLBACK_SELECTOR);

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

  function createHomeHoverUrlController({
    documentRef,
    windowRef,
    consoleRef,
    locationRef,
    MutationObserverCtor,
    setTimeoutFn = typeof setTimeout === 'function' ? setTimeout : null,
    clearTimeoutFn = typeof clearTimeout === 'function' ? clearTimeout : null,
  }) {
    let observer = null;
    let currentHoveredWatchUrl = null;
    let pendingPreviewRefreshTimeout = null;
    const trackedCards = new Set();

    function hasModernPlayerButton() {
      return Boolean(
        documentRef?.querySelector?.(
          `[${INJECTED_BUTTON_ATTR}="true"].${MODERN_PLAYER_BUTTON_CLASS}`
        )
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

        if (!hasModernPlayerButton()) {
          scheduleModernPreviewRefresh(attemptsRemaining - 1);
        }
      }, 120);
    }

    function bindModernPreviewTracking(card) {
      if (!card?.addEventListener || trackedCards.has(card)) {
        return;
      }

      const updateCurrentWatchUrl = () => {
        currentHoveredWatchUrl = getCardWatchUrl(card, windowRef) || currentHoveredWatchUrl;
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

        const injectedWrapper = createLogButtonWrapper(nativeButtons[0], canonicalUrl, consoleRef);

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

      const existingModernButton = modernControlsContainer.querySelector?.(
        `[${INJECTED_BUTTON_ATTR}="true"].${MODERN_PLAYER_BUTTON_CLASS}`
      );

      if (existingModernButton) {
        return;
      }

      const modernButton = createModernPlayerButton(
        documentRef,
        findModernPreviewButtonTemplate(modernControlsContainer),
        () => currentHoveredWatchUrl || canonicalUrl,
        consoleRef
      );

      if (!modernButton) {
        return;
      }

      modernControlsContainer.appendChild(modernButton);
    }

    function refresh() {
      if (!isHomePage(locationRef)) {
        return;
      }

      for (const card of getHomeCards(documentRef)) {
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

      if (!observer) {
        return;
      }

      observer.disconnect?.();
      observer = null;
    }

    return {
      URL_LOG_ICON_PATH,
      refresh,
      start,
      stop,
    };
  }

  return {
    BUTTON_LABEL,
    HOME_CARD_SELECTOR,
    HOVER_BUTTON_SELECTOR,
    INJECTED_BUTTON_ATTR,
    URL_LOG_ICON_PATH,
    createHomeHoverUrlController,
  };
});
