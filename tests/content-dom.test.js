const test = require('node:test');
const assert = require('node:assert/strict');

const dom = require('../content-dom.js');

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
  const { button, label, status } = createStatefulButton();

  dom.updateButtonState(button, 'loading');

  assert.equal(button.dataset.state, 'loading');
  assert.equal(button.disabled, true);
  assert.equal(label.textContent, 'Getting transcript...');
  assert.equal(status.textContent, 'Getting transcript...');
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
