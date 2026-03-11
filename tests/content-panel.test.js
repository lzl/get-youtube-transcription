const test = require('node:test');
const assert = require('node:assert/strict');

const { YoutubeTranscriptionExtension } = require('../content.js');

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

test('readTranscriptEntriesFromSegmentNodes extracts legacy transcript rows', () => {
  const entries = YoutubeTranscriptionExtension.readTranscriptEntriesFromSegmentNodes([
    createLegacySegment('0:03', 'legacy transcript'),
  ]);

  assert.deepEqual(entries, [['0:03', 'legacy transcript']]);
});

test('readTranscriptEntriesFromSegmentNodes extracts modern transcript rows', () => {
  const entries = YoutubeTranscriptionExtension.readTranscriptEntriesFromSegmentNodes([
    createModernSegment('0:00', 'modern transcript line'),
  ]);

  assert.deepEqual(entries, [['0:00', 'modern transcript line']]);
});

test('readTranscriptEntriesFromSegmentNodes falls back to stripped text when modern text span is missing', () => {
  const entries = YoutubeTranscriptionExtension.readTranscriptEntriesFromSegmentNodes([
    createModernSegment('1:24', 'about it in the first sort', {
      omitTextNode: true,
      a11yLabel: '1 minute, 24 seconds',
      fullText: '1:241 minute, 24 secondsabout it in the first sort',
    }),
  ]);

  assert.deepEqual(entries, [['1:24', 'about it in the first sort']]);
});
