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

function withStubbedTimers(run) {
  const timers = [];
  const clearedTimers = [];
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;

  global.setTimeout = (callback, delay) => {
    const timer = { callback, delay };
    timers.push(timer);
    return timer;
  };

  global.clearTimeout = (timer) => {
    clearedTimers.push(timer);
  };

  return Promise.resolve()
    .then(() => run({ timers, clearedTimers }))
    .finally(() => {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    });
}

test('handleTranscriptButtonClick shows success feedback before resetting to normal', async () => {
  await withStubbedTimers(async ({ timers }) => {
    const updates = [];
    const extension = Object.create(YoutubeTranscriptionExtension.prototype);
    extension.isExtracting = false;
    extension.buttonStateResetTimeout = null;
    extension.updateButtonState = (state) => {
      updates.push(state);
    };
    extension.extractTranscriptPackage = async () => ({ body: '0:01: first line' });
    extension.copyTextToClipboard = async () => {};

    await extension.handleTranscriptButtonClick();

    assert.deepEqual(updates, ['loading', 'success']);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 1800);

    timers[0].callback();

    assert.deepEqual(updates, ['loading', 'success', 'normal']);
    assert.equal(extension.isExtracting, false);
  });
});

test('handleTranscriptButtonClick clears any pending feedback reset when clicked again', async () => {
  await withStubbedTimers(async ({ clearedTimers }) => {
    const pendingTimer = { id: 'pending' };
    const extension = Object.create(YoutubeTranscriptionExtension.prototype);
    extension.isExtracting = false;
    extension.buttonStateResetTimeout = pendingTimer;
    extension.updateButtonState = () => {};
    extension.extractTranscriptPackage = async () => ({ body: '0:01: first line' });
    extension.copyTextToClipboard = async () => {};

    await extension.handleTranscriptButtonClick();

    assert.deepEqual(clearedTimers, [pendingTimer]);
  });
});

test('handleTranscriptButtonClick maps missing transcript errors to no_transcript feedback', async () => {
  await withStubbedTimers(async ({ timers }) => {
    const updates = [];
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const extension = Object.create(YoutubeTranscriptionExtension.prototype);
      extension.isExtracting = false;
      extension.buttonStateResetTimeout = null;
      extension.updateButtonState = (state) => {
        updates.push(state);
      };
      extension.extractTranscriptPackage = async () => {
        throw new Error('No captions found. This video may not have a transcript available.');
      };
      extension.copyTextToClipboard = async () => {};

      await extension.handleTranscriptButtonClick();

      assert.deepEqual(updates, ['loading', 'no_transcript']);
      assert.equal(timers.length, 1);
      assert.equal(timers[0].delay, 3000);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

test('handleTranscriptButtonClick maps clipboard failures to error feedback', async () => {
  await withStubbedTimers(async ({ timers }) => {
    const updates = [];
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const extension = Object.create(YoutubeTranscriptionExtension.prototype);
      extension.isExtracting = false;
      extension.buttonStateResetTimeout = null;
      extension.updateButtonState = (state) => {
        updates.push(state);
      };
      extension.extractTranscriptPackage = async () => ({ body: '0:01: first line' });
      extension.copyTextToClipboard = async () => {
        throw new Error('Clipboard blocked');
      };

      await extension.handleTranscriptButtonClick();

      assert.deepEqual(updates, ['loading', 'error']);
      assert.equal(timers.length, 1);
      assert.equal(timers[0].delay, 3000);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

test('handlePageChange starts home hover controller on the home page', () => {
  const extension = Object.create(YoutubeTranscriptionExtension.prototype);
  const calls = [];

  extension.startObservingButtonContainer = () => {
    calls.push('start-watch');
  };
  extension.getVideoId = (url) => (url.includes('watch?v=') ? 'video-123' : null);
  extension.cleanupPreviousButton = () => {
    calls.push('cleanup-watch');
  };
  extension.homeHoverController = {
    start() {
      calls.push('start-home-hover');
    },
    stop() {
      calls.push('stop-home-hover');
    },
  };

  extension.handlePageChange('https://www.youtube.com/');

  assert.deepEqual(calls, ['cleanup-watch', 'start-home-hover']);
});

test('handlePageChange stops home hover controller and resumes watch button handling on watch pages', () => {
  const extension = Object.create(YoutubeTranscriptionExtension.prototype);
  const calls = [];

  extension.startObservingButtonContainer = () => {
    calls.push('start-watch');
  };
  extension.getVideoId = (url) => (url.includes('watch?v=') ? 'video-123' : null);
  extension.cleanupPreviousButton = () => {
    calls.push('cleanup-watch');
  };
  extension.homeHoverController = {
    start() {
      calls.push('start-home-hover');
    },
    stop() {
      calls.push('stop-home-hover');
    },
  };

  extension.handlePageChange('https://www.youtube.com/watch?v=video-123');

  assert.deepEqual(calls, ['stop-home-hover', 'start-watch']);
});
