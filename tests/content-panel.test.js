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

  extension.startObservingButtonContainer = (surface) => {
    calls.push(`start-${surface || 'watch_like'}`);
  };
  extension.getPageSurface = (url) => {
    if (url.includes('/shorts/')) {
      return 'shorts';
    }

    if (url.includes('/watch?v=') || url.includes('/live/')) {
      return 'watch_like';
    }

    return 'other';
  };
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

  assert.deepEqual(calls, ['stop-list-hover', 'start-watch_like']);
});

test('handlePageChange stops list hover controller and resumes watch-like button handling on live pages', () => {
  const { extension, calls } = createPageChangeStub();

  extension.handlePageChange('https://www.youtube.com/live/video-123');

  assert.deepEqual(calls, ['stop-list-hover', 'start-watch_like']);
});

test('handlePageChange stops list hover controller and resumes shorts button handling on shorts pages', () => {
  const { extension, calls } = createPageChangeStub();

  extension.handlePageChange('https://www.youtube.com/shorts/video-123');

  assert.deepEqual(calls, ['stop-list-hover', 'start-shorts']);
});

test('getPageSurface classifies watch-like, shorts, and other pages', () => {
  const extension = Object.create(YoutubeTranscriptionExtension.prototype);

  assert.equal(extension.getPageSurface('https://www.youtube.com/watch?v=video-123'), 'watch_like');
  assert.equal(extension.getPageSurface('https://www.youtube.com/live/video-123'), 'watch_like');
  assert.equal(extension.getPageSurface('https://www.youtube.com/shorts/video-123'), 'shorts');
  assert.equal(extension.getPageSurface('https://www.youtube.com/'), 'other');
});

test('attemptToAddButton injects the shorts transcript action into the shorts action bar', () => {
  const appendedChildren = [];
  const shortsButton = { id: 'shorts-button' };
  const shortsRoot = { id: 'shorts-root' };
  const originalDocument = global.document;
  global.document = {};

  try {
    const extension = Object.create(YoutubeTranscriptionExtension.prototype);
    extension.transcriptButton = null;
    extension.transcriptButtonRoot = null;
    extension.findSuitableShortsActionBar = () => ({
      appendChild(child) {
        appendedChildren.push(child);
      },
    });
    extension.dom = {
      createShortsTranscriptButton() {
        return {
          root: shortsRoot,
          button: shortsButton,
        };
      },
    };

    extension.attemptToAddButton('shorts');

    assert.deepEqual(appendedChildren, [shortsRoot]);
    assert.equal(extension.transcriptButton, shortsButton);
    assert.equal(extension.transcriptButtonRoot, shortsRoot);
  } finally {
    global.document = originalDocument;
  }
});

test('attemptToAddButton delegates shorts action placement to the dom helper when available', () => {
  const insertCalls = [];
  const shortsButton = { id: 'shorts-button' };
  const shortsRoot = { id: 'shorts-root' };
  const actionBar = { id: 'shorts-bar' };
  const originalDocument = global.document;
  global.document = {};

  try {
    const extension = Object.create(YoutubeTranscriptionExtension.prototype);
    extension.transcriptButton = null;
    extension.transcriptButtonRoot = null;
    extension.findSuitableShortsActionBar = () => actionBar;
    extension.dom = {
      createShortsTranscriptButton() {
        return {
          root: shortsRoot,
          button: shortsButton,
        };
      },
      insertShortsTranscriptButton(container, root) {
        insertCalls.push({ container, root });
      },
    };

    extension.attemptToAddButton('shorts');

    assert.deepEqual(insertCalls, [{ container: actionBar, root: shortsRoot }]);
    assert.equal(extension.transcriptButton, shortsButton);
    assert.equal(extension.transcriptButtonRoot, shortsRoot);
  } finally {
    global.document = originalDocument;
  }
});

test('updateButtonState routes main shorts buttons through the shorts updater', () => {
  const extension = Object.create(YoutubeTranscriptionExtension.prototype);
  const updates = [];
  extension.transcriptButton = { id: 'shorts-button' };
  extension.transcriptButtonRoot = {
    getAttribute(name) {
      if (name === 'data-yt-shorts-transcript-button') {
        return 'true';
      }

      return null;
    },
  };
  extension.dom = {
    updateButtonState() {
      updates.push('watch');
    },
    updateShortsButtonState(_button, state) {
      updates.push(state);
    },
  };

  extension.updateButtonState('loading');

  assert.deepEqual(updates, ['loading']);
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
