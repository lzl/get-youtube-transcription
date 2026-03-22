const test = require('node:test');
const assert = require('node:assert/strict');

const dom = require('../content-dom.js');

const TRANSCRIPT_TILE_ICON_PATH = 'M7 4.5h10A2.5 2.5 0 0 1 19.5 7v2.25L16.75 12l2.75 2.75V17A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Zm1.25 4H14a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Zm0 3.5H15.5a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Zm0 3.5H13a.75.75 0 0 1 0 1.5H8.25a.75.75 0 0 1 0-1.5Z';

function createLegacySegment(timestamp, text) {
  return {
    querySelector(selector) {
      if (selector === 'div.segment-timestamp') {
        return { textContent: timestamp };
      }

      if (selector === 'yt-formatted-string') {
        return { textContent: text };
      }

      return null;
    },
  };
}

function createModernSegment(timestamp, text, options = {}) {
  return {
    textContent: options.fullText || `${timestamp}${text}`,
    querySelector(selector) {
      if (selector === '.ytwTranscriptSegmentViewModelTimestamp') {
        return { textContent: timestamp };
      }

      if (selector === '.ytwTranscriptSegmentViewModelTimestampA11yLabel') {
        return options.a11yLabel ? { textContent: options.a11yLabel } : null;
      }

      if (selector === 'span.yt-core-attributed-string[role="text"]') {
        return options.omitTextNode ? null : { textContent: text };
      }

      return null;
    },
  };
}

function createButton(options = {}) {
  return {
    textContent: options.textContent || '',
    getAttribute(name) {
      if (name === 'aria-label') {
        return options.ariaLabel || '';
      }

      return '';
    },
  };
}

test('content-dom reads legacy and modern transcript rows', () => {
  assert.deepEqual(dom.readTranscriptEntriesFromSegmentNodes([
    createLegacySegment('0:03', 'legacy transcript'),
    createModernSegment('0:00', 'modern transcript line'),
  ]), [
    ['0:03', 'legacy transcript'],
    ['0:00', 'modern transcript line'],
  ]);
});

test('content-dom strips timestamp and accessibility label from fallback transcript text', () => {
  assert.equal(
    dom.extractModernTranscriptFallbackText(
      createModernSegment('1:24', 'about it in the first sort', {
        omitTextNode: true,
        a11yLabel: '1 minute, 24 seconds',
        fullText: '1:241 minute, 24 secondsabout it in the first sort',
      }),
      '1:24'
    ),
    'about it in the first sort'
  );
});

test('content-dom creates transcript button markup with accessible status text', () => {
  const button = dom.createTranscriptButton({
    createElement() {
      return {
        type: '',
        className: '',
        title: '',
        ariaLabel: '',
        dataset: {},
        innerHTML: '',
        setAttribute(name, value) {
          if (name === 'aria-label') {
            this.ariaLabel = value;
          }
        },
        addEventListener() {},
      };
    },
  }, () => {});

  assert.equal(button.type, 'button');
  assert.equal(button.className, 'yt-transcript-extractor-btn');
  assert.equal(button.title, 'Get video transcript with one click');
  assert.equal(button.ariaLabel, 'Get video transcript with one click');
  assert.match(button.innerHTML, /yt-transcript-button-label/);
  assert.match(button.innerHTML, /yt-transcript-button-status/);
  assert.equal(button.innerHTML.includes(`d="${TRANSCRIPT_TILE_ICON_PATH}"`), true);
});

test('content-dom no longer exports the global notification helper', () => {
  assert.equal(dom.showUserNotification, undefined);
});

function createStatefulButton() {
  const label = { textContent: 'Transcript' };
  const status = { textContent: '' };
  const path = {
    d: 'initial',
    setAttribute(name, value) {
      if (name === 'd') {
        this.d = value;
      }
    },
    getAttribute(name) {
      if (name === 'd') {
        return this.d;
      }

      return null;
    },
  };

  const attributes = {
    title: 'Get video transcript with one click',
    'aria-label': 'Get video transcript with one click',
  };

  const button = {
    disabled: false,
    dataset: {},
    style: {},
    offsetWidth: 96,
    title: attributes.title,
    ownerDocument: {
      defaultView: {
        matchMedia() {
          return { matches: false };
        },
      },
    },
    classList: {
      values: new Set(),
      add(value) {
        this.values.add(value);
      },
      remove(value) {
        this.values.delete(value);
      },
      contains(value) {
        return this.values.has(value);
      },
    },
    setAttribute(name, value) {
      attributes[name] = value;

      if (name === 'title') {
        this.title = value;
      }
    },
    getBoundingClientRect() {
      if (this.style.width) {
        return { width: Number.parseFloat(this.style.width) || 96 };
      }

      if (label.textContent === 'Copied transcript') {
        return { width: 156 };
      }

      if (label.textContent === 'Getting transcript...') {
        return { width: 170 };
      }

      if (label.textContent === 'No transcript') {
        return { width: 138 };
      }

      if (label.textContent === 'Failed') {
        return { width: 108 };
      }

      return { width: 96 };
    },
    getAttribute(name) {
      return attributes[name] || null;
    },
    querySelector(selector) {
      if (selector === '.yt-transcript-button-label' || selector === 'span') {
        return label;
      }

      if (selector === '.yt-transcript-button-status') {
        return status;
      }

      if (selector === 'svg path') {
        return path;
      }

      return null;
    },
  };

  return { button, label, status, path };
}

function createHoverStatefulButton() {
  const wrapper = {
    dataset: {},
    className: 'ytInlinePlayerControlsTopRightControlsCircleButton yt-home-transcript-player-button',
    style: {},
  };
  const path = {
    d: 'initial',
    setAttribute(name, value) {
      if (name === 'd') {
        this.d = value;
      }
    },
    getAttribute(name) {
      if (name === 'd') {
        return this.d;
      }

      return null;
    },
  };
  const attributes = {
    title: 'Get video transcript with one click',
    'aria-label': 'Get video transcript with one click',
  };
  const button = {
    disabled: false,
    dataset: {},
    parentNode: wrapper,
    parentElement: wrapper,
    title: attributes.title,
    setAttribute(name, value) {
      attributes[name] = value;

      if (name === 'title') {
        this.title = value;
      }
    },
    getAttribute(name) {
      return attributes[name] || null;
    },
    querySelector(selector) {
      if (selector === 'svg path') {
        return path;
      }

      return null;
    },
  };

  return { button, path };
}

test('content-dom updates success button state with accessible copy feedback', () => {
  const { button, label, status, path } = createStatefulButton();

  dom.updateButtonState(button, 'success');

  assert.equal(button.dataset.state, 'success');
  assert.equal(button.disabled, false);
  assert.equal(label.textContent, 'Copied transcript');
  assert.equal(status.textContent, 'Transcript copied to clipboard');
  assert.equal(button.title, 'Transcript copied to clipboard');
  assert.equal(button.getAttribute('aria-label'), 'Transcript copied to clipboard');
  assert.notEqual(path.getAttribute('d'), 'initial');
});

test('content-dom updates loading button state and keeps it disabled', () => {
  const { button, label, status, path } = createStatefulButton();

  dom.updateButtonState(button, 'loading');

  assert.equal(button.dataset.state, 'loading');
  assert.equal(button.disabled, true);
  assert.equal(label.textContent, 'Getting transcript...');
  assert.equal(status.textContent, 'Getting transcript...');
  assert.equal(path.getAttribute('d'), TRANSCRIPT_TILE_ICON_PATH);
});

test('content-dom updates hover button state without watch-button width animation', () => {
  const { button, path } = createHoverStatefulButton();

  dom.updateHoverButtonState(button, 'success');

  assert.equal(button.dataset.state, 'success');
  assert.equal(button.parentNode.dataset.state, 'success');
  assert.equal(button.parentNode.style.boxShadow, 'inset 0 0 0 1px #86efac');
  assert.equal(button.parentNode.style.color, '#86efac');
  assert.equal(button.disabled, false);
  assert.equal(button.title, 'Transcript copied to clipboard');
  assert.equal(button.getAttribute('aria-label'), 'Transcript copied to clipboard');
  assert.notEqual(path.getAttribute('d'), 'initial');
});

test('content-dom updates hover button loading state and keeps it disabled', () => {
  const { button, path } = createHoverStatefulButton();

  dom.updateHoverButtonState(button, 'loading');

  assert.equal(button.dataset.state, 'loading');
  assert.equal(button.parentNode.dataset.state, 'loading');
  assert.equal(button.parentNode.style.boxShadow, '');
  assert.equal(button.parentNode.style.color, '');
  assert.equal(button.disabled, true);
  assert.equal(button.title, 'Getting transcript...');
  assert.equal(button.getAttribute('aria-label'), 'Getting transcript...');
  assert.equal(path.getAttribute('d'), TRANSCRIPT_TILE_ICON_PATH);
});

test('content-dom animates button width when desktop label length changes', () => {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const timers = [];

  global.setTimeout = (callback, delay) => {
    const timer = { callback, delay };
    timers.push(timer);
    return timer;
  };

  global.clearTimeout = () => {};

  try {
    const { button } = createStatefulButton();

    dom.updateButtonState(button, 'success');

    assert.equal(button.style.width, '156px');
    assert.equal(button.classList.contains('yt-transcript-extractor-btn--animating'), true);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 220);

    timers[0].callback();

    assert.equal(button.style.width, '');
    assert.equal(button.classList.contains('yt-transcript-extractor-btn--animating'), false);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});

test('findTranscriptPanelButton returns the visible transcript section button', () => {
  const transcriptButton = createButton();
  const documentRef = {
    querySelector(selector) {
      if (selector === 'ytd-video-description-transcript-section-renderer #primary-button button') {
        return transcriptButton;
      }

      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  assert.equal(dom.findTranscriptPanelButton(documentRef, () => true), transcriptButton);
});

test('findTranscriptPanelButton ignores generic primary buttons outside transcript containers', () => {
  const unrelatedPrimaryButton = createButton();
  const documentRef = {
    querySelector(selector) {
      if (selector === '#primary-button > ytd-button-renderer > yt-button-shape > button') {
        return unrelatedPrimaryButton;
      }

      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  assert.equal(dom.findTranscriptPanelButton(documentRef, () => true), null);
});

test('findTranscriptPanelButton does not match localized labels without transcript structure', () => {
  const localizedButton = createButton({
    textContent: '显示字幕',
    ariaLabel: '显示字幕',
  });
  const documentRef = {
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button') {
        return [localizedButton];
      }

      return [];
    },
  };

  assert.equal(dom.findTranscriptPanelButton(documentRef, () => true), null);
});

test('findSuitableButtonContainer ignores shorts-only action containers', () => {
  const shortsActions = { isShortsActions: true };
  const documentRef = {
    querySelector(selector) {
      if (selector === 'ytd-shorts #actions') {
        return shortsActions;
      }

      return null;
    },
  };

  assert.equal(dom.findSuitableButtonContainer(documentRef), null);
});
