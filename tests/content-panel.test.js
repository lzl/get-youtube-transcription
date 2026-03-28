const test = require('node:test');
const assert = require('node:assert/strict');

const { YoutubeTranscriptionExtension } = require('../content.js');

test('YoutubeTranscriptionExtension no longer exposes transcript panel readers', () => {
  assert.equal(YoutubeTranscriptionExtension.readTranscriptEntriesFromSegmentNodes, undefined);
  assert.equal(YoutubeTranscriptionExtension.extractModernTranscriptFallbackText, undefined);
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

function createPageChangeStub() {
  const calls = [];
  const extension = Object.create(YoutubeTranscriptionExtension.prototype);

  extension.startObservingButtonContainer = () => {
    calls.push('start-watch');
  };
  extension.getVideoId = (url) => (url.includes('watch?v=') ? 'video-123' : null);
  extension.cleanupPreviousButton = () => {
    calls.push('cleanup-watch');
  };
  extension.listHoverController = {
    start() {
      calls.push('start-list-hover');
    },
    stop() {
      calls.push('stop-list-hover');
    },
  };

  return { extension, calls };
}

test('handlePageChange starts list hover controller on the root list page', () => {
  const { extension, calls } = createPageChangeStub();

  extension.handlePageChange('https://www.youtube.com/');

  assert.deepEqual(calls, ['cleanup-watch', 'start-list-hover']);
});

test('handlePageChange starts list hover controller on non-watch list pages', () => {
  const { extension, calls } = createPageChangeStub();

  extension.handlePageChange('https://www.youtube.com/feed/subscriptions');

  assert.deepEqual(calls, ['cleanup-watch', 'start-list-hover']);
});

test('handlePageChange stops list hover controller and resumes watch button handling on watch pages', () => {
  const { extension, calls } = createPageChangeStub();

  extension.handlePageChange('https://www.youtube.com/watch?v=video-123');

  assert.deepEqual(calls, ['stop-list-hover', 'start-watch']);
});

test('findCaptionToggleButton returns the last visible list-page preview cc button', () => {
  const hiddenPreviewButton = {
    className: 'ytmClosedCaptioningButtonButton',
  };
  const visiblePreviewButton = {
    className: 'ytmClosedCaptioningButtonButton',
  };
  const extension = Object.create(YoutubeTranscriptionExtension.prototype);
  extension.isElementVisible = (element) => element === visiblePreviewButton;

  const selectedButton = extension.findCaptionToggleButton({
    querySelectorAll(selector) {
      if (selector === '.ytInlinePlayerControlsTopRightControls .ytmClosedCaptioningButtonButton') {
        return [hiddenPreviewButton, visiblePreviewButton];
      }

      return [];
    },
  });

  assert.equal(selectedButton, visiblePreviewButton);
});
