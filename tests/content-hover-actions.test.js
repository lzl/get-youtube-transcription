const test = require('node:test');
const assert = require('node:assert/strict');

const { createHomeHoverUrlController } = require('../content-hover-actions.js');

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
  const tooltip = { textContent: 'Original tooltip' };
  const iconPath = {
    value: 'original-path',
    setAttribute(name, value) {
      if (name === 'd') {
        this.value = value;
      }
    },
    getAttribute(name) {
      if (name === 'd') {
        return this.value;
      }

      return null;
    },
  };
  const button = {
    title: 'Original title',
    ariaLabel: 'Original label',
    listeners: new Map(),
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;

      if (name === 'aria-label') {
        this.ariaLabel = value;
      }

      if (name === 'title') {
        this.title = value;
      }
    },
    getAttribute(name) {
      return this.attributes[name] || null;
    },
    addEventListener(name, handler) {
      this.listeners.set(name, handler);
    },
  };
  const wrapper = {
    button,
    tooltip,
    iconPath,
    dataset: {},
    setAttribute(name, value) {
      this.dataset[name] = value;
    },
    getAttribute(name) {
      return this.dataset[name] || null;
    },
    querySelector(selector) {
      if (selector === 'button') {
        return button;
      }

      if (selector === 'svg path') {
        return iconPath;
      }

      if (selector === '#tooltip, tp-yt-paper-tooltip #tooltip, yt-formatted-string') {
        return tooltip;
      }

      return null;
    },
    cloneNode() {
      return createNativeButtonWrapper();
    },
  };

  return wrapper;
}

function createCard(options = {}) {
  const toolbarChildren = [];
  const nativeButton = options.nativeButton || createNativeButtonWrapper();
  const toolbar = {
    children: toolbarChildren,
    appendChild(node) {
      toolbarChildren.push(node);
      return node;
    },
  };
  const watchLink = options.href
    ? { href: options.href }
    : null;

  return {
    toolbar,
    nativeButtons: options.withButtons === false ? [] : [nativeButton],
    querySelector(selector) {
      if (selector === 'a[href*="/watch"]') {
        return watchLink;
      }

      if (selector === '[data-yt-home-url-logger="true"]') {
        return toolbarChildren.find((child) => child.getAttribute('data-yt-home-url-logger') === 'true') || null;
      }

      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'ytd-thumbnail-overlay-toggle-button-renderer') {
        return this.nativeButtons.concat(toolbarChildren);
      }

      return [];
    },
  };
}

function createDocument(cards) {
  return {
    querySelectorAll(selector) {
      if (selector === 'ytd-rich-grid-renderer ytd-rich-item-renderer') {
        return cards;
      }

      return [];
    },
  };
}

test('home hover controller injects one native-looking button and logs canonical URL on click', () => {
  const card = createCard({
    href: '/watch?v=abc123&pp=ygUPc29tZXRoaW5nLWVsc2U%3D',
  });
  const loggedValues = [];
  const observerInstances = [];
  const controller = createHomeHoverUrlController({
    documentRef: createDocument([card]),
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    consoleRef: {
      log(value) {
        loggedValues.push(value);
      },
    },
    MutationObserverCtor: class {
      constructor(callback) {
        this.callback = callback;
        observerInstances.push(this);
      }

      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  assert.equal(card.toolbar.children.length, 1);
  const insertedWrapper = card.toolbar.children[0];
  const insertedButton = insertedWrapper.querySelector('button');

  assert.equal(insertedButton.title, 'Log video URL');
  assert.equal(insertedButton.ariaLabel, 'Log video URL');
  assert.equal(insertedWrapper.querySelector('svg path').getAttribute('d'), controller.URL_LOG_ICON_PATH);

  const clickEvent = createEvent();
  insertedButton.listeners.get('click')(clickEvent);

  assert.deepEqual(loggedValues, ['https://www.youtube.com/watch?v=abc123']);
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.propagationStopped, true);

  controller.refresh();

  assert.equal(card.toolbar.children.length, 1);
  assert.equal(observerInstances.length, 0);
});

test('home hover controller skips non-home pages and cards without a valid watch button target', () => {
  const cards = [
    createCard({ href: null }),
    createCard({ href: '/watch?v=abc123', withButtons: false }),
  ];
  const controller = createHomeHoverUrlController({
    documentRef: createDocument(cards),
    locationRef: { pathname: '/watch' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    consoleRef: console,
    MutationObserverCtor: class {
      observe() {}
      disconnect() {}
    },
  });

  controller.refresh();

  assert.equal(cards[0].toolbar.children.length, 0);
  assert.equal(cards[1].toolbar.children.length, 0);
});

test('home hover controller starts and stops its observer around refreshes', () => {
  const card = createCard({ href: '/watch?v=observer123' });
  const observeCalls = [];
  const disconnectCalls = [];
  const controller = createHomeHoverUrlController({
    documentRef: createDocument([card]),
    locationRef: { pathname: '/' },
    windowRef: { location: { origin: 'https://www.youtube.com' } },
    consoleRef: console,
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

  assert.equal(card.toolbar.children.length, 1);
  assert.equal(observeCalls.length, 1);

  controller.stop();

  assert.equal(disconnectCalls.length, 1);
});
