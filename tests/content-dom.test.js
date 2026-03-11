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

test('content-dom creates the unchanged transcript button markup', () => {
  const button = dom.createTranscriptButton({
    createElement() {
      return {
        type: '',
        className: '',
        title: '',
        innerHTML: '',
        addEventListener() {},
      };
    },
  }, () => {});

  assert.equal(button.type, 'button');
  assert.equal(button.className, 'yt-transcript-extractor-btn');
  assert.equal(button.title, 'Get video transcript with one click');
  assert.match(button.innerHTML, /<span>Transcript<\/span>/);
});
