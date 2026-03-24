const test = require('node:test');
const assert = require('node:assert/strict');

const { createHomeHoverUrlController } = require('../content-hover-actions.js');

const TRANSCRIPT_BUTTON_TITLE = 'Copy transcript';
const TRANSCRIPT_ICON_PATH = 'M7 4.5h10A2.5 2.5 0 0 1 19.5 7v2.25L16.75 12l2.75 2.75V17A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Zm1.25 4H14a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Zm0 3.5H15.5a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Zm0 3.5H13a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Z';

function createMockElement(tagName, options = {}) {
  const element = {
    tagName: String(tagName || '').toUpperCase(),
    attributes: { ...(options.attributes || {}) },
    children: [],
    listeners: new Map(),
    className: options.className || '',
    id: options.id || '',
    textContent: options.textContent || '',
    title: options.title || '',
    ariaLabel: options.ariaLabel || '',
    type: options.type || '',
    style: {},
    parentNode: null,
    parentElement: null,
    appendChild(child) {
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;

      if (name === 'class') {
        this.className = value;
      }

      if (name === 'id') {
        this.id = value;
      }

      if (name === 'title') {
        this.title = value;
      }

      if (name === 'aria-label') {
        this.ariaLabel = value;
      }
    },
    getAttribute(name) {
      if (name === 'class') {
        return this.className || null;
      }

      if (name === 'id') {
        return this.id || null;
      }

      if (name === 'title') {
        return this.title || null;
      }

      if (name === 'aria-label') {
        return this.ariaLabel || null;
      }

      return this.attributes[name] || null;
    },
    removeAttribute(name) {
      delete this.attributes[name];

      if (name === 'class') {
        this.className = '';
      }

      if (name === 'id') {
        this.id = '';
      }

      if (name === 'title') {
        this.title = '';
      }

      if (name === 'aria-label') {
        this.ariaLabel = '';
      }
    },
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
    querySelector(selector) {
      return queryElements(this, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return queryElements(this, selector);
    },
    cloneNode() {
      return cloneMockElement(this);
    },
  };

  if (element.className) {
    element.attributes.class = element.className;
  }

  if (element.id) {
    element.attributes.id = element.id;
  }

  if (element.title) {
    element.attributes.title = element.title;
  }

  if (element.ariaLabel) {
    element.attributes['aria-label'] = element.ariaLabel;
  }

  return element;
}

function cloneMockElement(source) {
  const clone = createMockElement(source.tagName, {
    attributes: source.attributes,
    className: source.className,
    id: source.id,
    textContent: source.textContent,
    title: source.title,
    ariaLabel: source.ariaLabel,
    type: source.type,
  });

  for (const child of source.children) {
    clone.appendChild(cloneMockElement(child));
  }

  return clone;
}

function walkElements(root, visitor) {
  for (const child of root?.children || []) {
    visitor(child);
    walkElements(child, visitor);
  }
}

function matchesSelector(element, selector) {
  if (!element) {
    return false;
  }

  if (selector === 'button') {
    return element.tagName === 'BUTTON';
  }

  if (selector === 'svg path') {
    return element.tagName === 'PATH' && element.parentNode?.tagName === 'SVG';
  }

  if (selector === '#tooltip, tp-yt-paper-tooltip #tooltip, yt-formatted-string') {
    return element.id === 'tooltip' || element.tagName === 'YT-FORMATTED-STRING';
  }

  if (selector === '#tooltip') {
    return element.id === 'tooltip';
  }

  if (selector === 'yt-formatted-string') {
    return element.tagName === 'YT-FORMATTED-STRING';
  }

  if (selector === '[data-yt-home-transcript-button="true"]') {
    return element.getAttribute('data-yt-home-transcript-button') === 'true';
  }

  if (selector === '[data-yt-home-transcript-button="true"].yt-home-transcript-player-button') {
    return (
      element.getAttribute('data-yt-home-transcript-button') === 'true' &&
      String(element.className).split(/\s+/).includes('yt-home-transcript-player-button')
    );
  }

  if (selector === 'ytd-thumbnail-overlay-toggle-button-renderer') {
    return element.tagName === 'YTD-THUMBNAIL-OVERLAY-TOGGLE-BUTTON-RENDERER';
  }

  if (selector === '.yt-lockup-view-model') {
    return String(element.className).split(/\s+/).includes('yt-lockup-view-model');
  }

  if (selector === '.ytInlinePlayerControlsTopRightControls') {
    return String(element.className).split(/\s+/).includes('ytInlinePlayerControlsTopRightControls');
  }

  if (selector === '.ytInlinePlayerControlsTopRightControlsCircleButton') {
    return String(element.className)
      .split(/\s+/)
      .includes('ytInlinePlayerControlsTopRightControlsCircleButton');
  }

  if (selector === 'yt-inline-player-controls .ytInlinePlayerControlsTopRightControls') {
    return (
      String(element.className).split(/\s+/).includes('ytInlinePlayerControlsTopRightControls') &&
      hasAncestor(element, (node) => node.tagName === 'YT-INLINE-PLAYER-CONTROLS')
    );
  }

  if (selector === 'yt-thumbnail-view-model') {
    return element.tagName === 'YT-THUMBNAIL-VIEW-MODEL';
  }

  if (selector === 'a[href*="/watch"]' || selector === 'a#thumbnail[href*="/watch"]' || selector === 'a[href*="/watch?v="]') {
    return element.tagName === 'A' && String(element.getAttribute('href') || '').includes('/watch');
  }

  return false;
}

function hasAncestor(element, predicate) {
  let current = element?.parentElement || element?.parentNode || null;

  while (current) {
    if (predicate(current)) {
      return true;
    }

    current = current.parentElement || current.parentNode || null;
  }

  return false;
}

function queryElements(root, selector) {
  const matches = [];
  walkElements(root, (element) => {
    if (matchesSelector(element, selector)) {
      matches.push(element);
    }
  });
  return matches;
}

function createEvent() {
  return {
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
}

function createNativeButtonWrapper() {
  const wrapper = createMockElement('ytd-thumbnail-overlay-toggle-button-renderer');
  const button = createMockElement('button', {
    title: 'Original title',
    ariaLabel: 'Original label',
  });
  const svg = createMockElement('svg');
  const iconPath = createMockElement('path', {
    attributes: { d: 'original-path' },
  });
  const tooltip = createMockElement('yt-formatted-string', {
    textContent: 'Original tooltip',
  });

  svg.appendChild(iconPath);
  wrapper.appendChild(button);
  wrapper.appendChild(svg);
  wrapper.appendChild(tooltip);

  return wrapper;
}

function createCard(options = {}) {
  const nativeButton = options.nativeButton || createNativeButtonWrapper();
  const card = createMockElement('ytd-rich-item-renderer');
  const toolbar = createMockElement('div');

  if (options.href) {
    const watchLink = createMockElement('a', {
      attributes: { href: options.href },
    });

    if (options.modern === true) {
      const lockupRoot = createMockElement('div', {
        className: 'yt-lockup-view-model yt-lockup-view-model--vertical',
      });
      const thumbnail = createMockElement('yt-thumbnail-view-model');

      watchLink.appendChild(thumbnail);
      lockupRoot.appendChild(watchLink);
      card.appendChild(lockupRoot);
    } else {
      card.appendChild(watchLink);
    }
  }

  card.appendChild(toolbar);
  card.toolbar = toolbar;

  if (options.withButtons !== false) {
    toolbar.appendChild(nativeButton);
  }

  return card;
}

function createModernPreviewControls() {
  const controlsHost = createMockElement('yt-inline-player-controls', {
    className: 'ytInlinePlayerControlsHost',
  });
  const controlsWrapper = createMockElement('div');
  const topRightControls = createMockElement('div', {
    className: 'ytInlinePlayerControlsTopRightControls',
  });

  const createCircleButton = (hostTag, hostClassName, buttonClassName, title, iconPathValue) => {
    const circleButton = createMockElement('div', {
      className: 'ytInlinePlayerControlsTopRightControlsCircleButton',
    });
    const iconContainer = createMockElement('div', {
      className: 'ytInlinePlayerControlsButtonIcon',
    });
    const host = createMockElement(hostTag, {
      className: hostClassName,
    });
    const button = createMockElement('button', {
      className: buttonClassName,
      title,
      ariaLabel: title,
    });
    const span = createMockElement('span');
    const svg = createMockElement('svg');
    const path = createMockElement('path', {
      attributes: { d: iconPathValue },
    });

    svg.appendChild(path);
    span.appendChild(svg);
    button.appendChild(span);
    host.appendChild(button);
    iconContainer.appendChild(host);
    circleButton.appendChild(iconContainer);
    return circleButton;
  };

  topRightControls.appendChild(
    createCircleButton(
      'ytm-mute-button',
      'ytmMuteButtonHost',
      'ytmMuteButtonButton',
      'Unmute',
      'mute-path'
    )
  );
  topRightControls.appendChild(
    createCircleButton(
      'ytm-closed-captioning-button',
      'ytmClosedCaptioningButtonHost',
      'ytmClosedCaptioningButtonButton',
      'Subtitles/CC turned on',
      'cc-path'
    )
  );

  controlsWrapper.appendChild(topRightControls);
  controlsHost.appendChild(controlsWrapper);

  return {
    controlsHost,
    topRightControls,
  };
}

function createDocument(cards, options = {}) {
  const body = createMockElement('body');

  for (const card of cards) {
    body.appendChild(card);
  }

  if (options.withGlobalPreviewControls) {
    const previewRoot = createMockElement('ytd-video-preview');
    const mediaContainer = createMockElement('div', {
      id: 'media-container',
    });
    const previewPlayerContainer = createMockElement('div');
    const previewPlayer = createMockElement('div', {
      id: 'inline-preview-player',
    });
    const playerControls = createMockElement('div', {
      id: 'player-controls',
    });
    const previewControls = createModernPreviewControls();

    previewPlayerContainer.appendChild(previewPlayer);
    playerControls.appendChild(previewControls.controlsHost);
    mediaContainer.appendChild(previewPlayerContainer);
    mediaContainer.appendChild(playerControls);
    previewRoot.appendChild(mediaContainer);
    body.appendChild(previewRoot);
    body.previewControls = previewControls.topRightControls;
  }

  return {
    body,
    querySelectorAll(selector) {
      if (
        selector === 'ytd-rich-grid-renderer ytd-rich-item-renderer' ||
        selector === 'ytd-rich-item-renderer' ||
        selector === 'ytd-rich-grid-renderer ytd-rich-item-renderer, ytd-rich-item-renderer'
      ) {
        return cards;
      }

      return body.querySelectorAll(selector);
    },
    querySelector(selector) {
      return body.querySelector(selector);
    },
    createElement(tagName) {
      return createMockElement(tagName);
    },
    createElementNS(_namespace, tagName) {
      return createMockElement(tagName);
    },
  };
}

test('home hover controller injects one native-looking transcript button and reports the clicked watch URL', () => {
  const card = createCard({
    href: '/watch?v=abc123&pp=ygUPc29tZXRoaW5nLWVsc2U%3D',
  });
  const clickPayloads = [];
  const controller = createHomeHoverUrlController({
    documentRef: createDocument([card]),
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick(payload) {
      clickPayloads.push(payload);
    },
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  const insertedWrapper = card.querySelector('[data-yt-home-transcript-button="true"]');
  const insertedButton = insertedWrapper.querySelector('button');

  assert.ok(insertedWrapper);
  assert.match(insertedWrapper.className, /yt-home-transcript-player-button/);
  assert.equal(insertedButton.title, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedButton.ariaLabel, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedButton._ytTranscriptNormalTitle, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedButton._ytTranscriptNormalAriaLabel, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedWrapper.querySelector('svg path').getAttribute('d'), TRANSCRIPT_ICON_PATH);

  const clickEvent = createEvent();
  insertedButton.listeners.get('click')(clickEvent);

  assert.equal(clickPayloads.length, 1);
  assert.equal(clickPayloads[0].watchUrl, 'https://www.youtube.com/watch?v=abc123');
  assert.equal(clickPayloads[0].buttonElement, insertedButton);
  assert.equal(clickPayloads[0].buttonKind, 'native');
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.propagationStopped, true);
  assert.equal(insertedWrapper.listeners.get('click'), undefined);

  controller.refresh();

  assert.equal(card.querySelectorAll('[data-yt-home-transcript-button="true"]').length, 1);
});

test('home hover controller injects the modern transcript button into the inline preview top-right controls cluster', () => {
  const card = createCard({
    href: '/watch?v=modern123',
    modern: true,
    withButtons: false,
  });
  const clickPayloads = [];
  const documentRef = createDocument([card], {
    withGlobalPreviewControls: true,
  });
  const controller = createHomeHoverUrlController({
    documentRef,
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick(payload) {
      clickPayloads.push(payload);
    },
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  const insertedWrapper = documentRef.querySelector('[data-yt-home-transcript-button="true"]');
  const insertedButton = insertedWrapper.querySelector('button');

  assert.ok(insertedWrapper);
  assert.equal(insertedWrapper.parentNode, documentRef.body.previewControls);
  assert.equal(insertedButton?.title, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedButton?.ariaLabel, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedButton?._ytTranscriptNormalTitle, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedButton?._ytTranscriptNormalAriaLabel, TRANSCRIPT_BUTTON_TITLE);
  assert.equal(insertedWrapper.querySelector('svg path').getAttribute('d'), TRANSCRIPT_ICON_PATH);
  assert.match(insertedWrapper.className, /yt-home-transcript-player-button/);

  const clickEvent = createEvent();
  const enterHandler = card.listeners.get('mouseenter');
  enterHandler();
  insertedButton.listeners.get('click')(clickEvent);

  assert.equal(clickPayloads.length, 1);
  assert.equal(clickPayloads[0].watchUrl, 'https://www.youtube.com/watch?v=modern123');
  assert.equal(clickPayloads[0].buttonElement, insertedButton);
  assert.equal(clickPayloads[0].buttonKind, 'modern');
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.propagationStopped, true);
  assert.equal(insertedWrapper.listeners.get('click'), undefined);

  controller.refresh();

  assert.equal(documentRef.querySelectorAll('[data-yt-home-transcript-button="true"]').length, 1);
});

test('home hover controller injects on non-home list pages that reuse the same card structure', () => {
  const card = createCard({
    href: '/watch?v=listpage123',
  });
  const controller = createHomeHoverUrlController({
    documentRef: createDocument([card]),
    locationRef: { pathname: '/feed/subscriptions' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick() {},
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  assert.equal(card.querySelectorAll('[data-yt-home-transcript-button="true"]').length, 1);
});

test('home hover controller waits for modern preview controls instead of creating a standalone overlay', () => {
  const card = createCard({
    href: '/watch?v=modern456',
    modern: true,
    withButtons: false,
  });
  const controller = createHomeHoverUrlController({
    documentRef: createDocument([card]),
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    consoleRef: console,
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  assert.equal(card.querySelectorAll('[data-yt-home-transcript-button="true"]').length, 0);
});

test('home hover controller keeps retrying until the active modern controls cluster gets the injected button', () => {
  const card = createCard({
    href: '/watch?v=modern999',
    modern: true,
    withButtons: false,
  });
  const scheduledCallbacks = [];
  const documentRef = createDocument([card]);
  const stalePreviewControls = createModernPreviewControls();
  const staleInjectedButton = createMockElement('div', {
    className: 'ytInlinePlayerControlsTopRightControlsCircleButton yt-home-transcript-player-button',
    attributes: { 'data-yt-home-transcript-button': 'true' },
  });

  stalePreviewControls.topRightControls.appendChild(staleInjectedButton);
  documentRef.body.appendChild(stalePreviewControls.controlsHost);

  const controller = createHomeHoverUrlController({
    documentRef,
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick() {},
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
    setTimeoutFn(callback) {
      scheduledCallbacks.push(callback);
      return scheduledCallbacks.length;
    },
    clearTimeoutFn() {},
  });

  controller.refresh();
  card.listeners.get('mouseenter')();

  assert.equal(scheduledCallbacks.length, 1);
  scheduledCallbacks.shift()();

  assert.equal(scheduledCallbacks.length, 1);

  const freshPreviewControls = createModernPreviewControls();
  documentRef.body.appendChild(freshPreviewControls.controlsHost);

  scheduledCallbacks.shift()();

  const injectedButtons = freshPreviewControls.topRightControls.querySelectorAll(
    '[data-yt-home-transcript-button="true"]'
  );

  assert.equal(injectedButtons.length, 1);
});

test('home hover controller retries modern preview injection when preview controls appear after hover starts', () => {
  const card = createCard({
    href: '/watch?v=modern789',
    modern: true,
    withButtons: false,
  });
  const clickPayloads = [];
  const scheduledCallbacks = [];
  const documentRef = createDocument([card]);
  const controller = createHomeHoverUrlController({
    documentRef,
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick(payload) {
      clickPayloads.push(payload);
    },
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
    setTimeoutFn(callback) {
      scheduledCallbacks.push(callback);
      return scheduledCallbacks.length;
    },
    clearTimeoutFn() {},
  });

  controller.refresh();
  card.listeners.get('mouseenter')();

  const previewRoot = createMockElement('ytd-video-preview');
  const mediaContainer = createMockElement('div', {
    id: 'media-container',
  });
  const previewPlayerContainer = createMockElement('div');
  const previewPlayer = createMockElement('div', {
    id: 'inline-preview-player',
  });
  const playerControls = createMockElement('div', {
    id: 'player-controls',
  });
  const previewControls = createModernPreviewControls();

  previewPlayerContainer.appendChild(previewPlayer);
  playerControls.appendChild(previewControls.controlsHost);
  mediaContainer.appendChild(previewPlayerContainer);
  mediaContainer.appendChild(playerControls);
  previewRoot.appendChild(mediaContainer);
  documentRef.body.appendChild(previewRoot);

  assert.equal(documentRef.querySelectorAll('[data-yt-home-transcript-button="true"]').length, 0);
  assert.equal(scheduledCallbacks.length > 0, true);

  scheduledCallbacks.shift()();

  const insertedWrapper = documentRef.querySelector('[data-yt-home-transcript-button="true"]');
  const insertedButton = insertedWrapper.querySelector('button');
  assert.ok(insertedWrapper);
  assert.equal(insertedWrapper.parentNode, previewControls.topRightControls);

  const clickEvent = createEvent();
  insertedButton.listeners.get('click')(clickEvent);

  assert.equal(clickPayloads.length, 1);
  assert.equal(clickPayloads[0].watchUrl, 'https://www.youtube.com/watch?v=modern789');
  assert.equal(clickPayloads[0].buttonElement, insertedButton);
  assert.equal(clickPayloads[0].buttonKind, 'modern');
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.propagationStopped, true);
});

test('home hover controller skips watch pages even when cards have valid watch targets', () => {
  const cards = [
    createCard({ href: '/watch?v=abc123', withButtons: false }),
    createCard({ href: '/watch?v=def456' }),
  ];
  const controller = createHomeHoverUrlController({
    documentRef: createDocument(cards),
    locationRef: { pathname: '/watch' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick() {},
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  assert.equal(cards[0].querySelectorAll('[data-yt-home-transcript-button="true"]').length, 0);
  assert.equal(cards[1].querySelectorAll('[data-yt-home-transcript-button="true"]').length, 0);
});

test('home hover controller skips cards without a valid watch button target on list pages', () => {
  const cards = [
    createCard({ href: null, withButtons: false }),
    createCard({ href: '/watch?v=abc123', withButtons: false }),
  ];
  const controller = createHomeHoverUrlController({
    documentRef: createDocument(cards),
    locationRef: { pathname: '/results' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick() {},
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  assert.equal(cards[0].querySelectorAll('[data-yt-home-transcript-button="true"]').length, 0);
  assert.equal(cards[1].querySelectorAll('[data-yt-home-transcript-button="true"]').length, 0);
});

test('home hover controller starts and stops its observer around refreshes', () => {
  const card = createCard({ href: '/watch?v=observer123' });
  const observeCalls = [];
  const disconnectCalls = [];
  const controller = createHomeHoverUrlController({
    documentRef: createDocument([card]),
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    onTranscriptButtonClick() {},
    MutationObserverCtor: class {
      constructor(callback) {
        this.callback = callback;
      }

      observe(target, options) {
        observeCalls.push({ target, options });
      }

      disconnect() {
        disconnectCalls.push(true);
      }
    },
  });

  controller.start();

  assert.equal(card.querySelectorAll('[data-yt-home-transcript-button="true"]').length, 1);
  assert.equal(observeCalls.length, 1);

  controller.stop();

  assert.equal(disconnectCalls.length, 1);
});
