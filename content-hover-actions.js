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
  const INJECTED_BUTTON_ATTR = 'data-yt-home-url-logger';
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

  function findHoverButtonContainer(card, nativeButtons) {
    const lastNativeButton = nativeButtons[nativeButtons.length - 1];
    return lastNativeButton?.parentNode || lastNativeButton?.parentElement || card?.toolbar || null;
  }

  function createHomeHoverUrlController({
    documentRef,
    windowRef,
    consoleRef,
    locationRef,
    MutationObserverCtor,
  }) {
    let observer = null;

    function injectIntoCard(card) {
      if (!card || hasInjectedButton(card)) {
        return;
      }

      const canonicalUrl = getCardWatchUrl(card, windowRef);

      if (!canonicalUrl) {
        return;
      }

      const nativeButtons = getNativeHoverButtons(card);

      if (nativeButtons.length === 0) {
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
