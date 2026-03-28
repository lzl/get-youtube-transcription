const test = require('node:test');
const assert = require('node:assert/strict');

const { createTranscriptWorkflow } = require('../content-transcript.js');

function createWorkflow(overrides = {}) {
  return createTranscriptWorkflow({
    fetchHtml: async () => '<html></html>',
    fetchInnerTubeTranscript: async () => [],
    fetchTimedTextTranscript: async () => [],
    extractPlayerResponse: () => null,
    resolvePageData: () => ({ title: 'Resolved Title' }),
    getVideoIdFromUrl: () => 'video-123',
    getPageTitle: () => 'Fallback Title',
    getCurrentUrl: () => 'https://www.youtube.com/watch?v=video-123',
    ...overrides,
  });
}

test('createTranscriptWorkflow keeps the current URL and does not rewrite shorts URLs', () => {
  const workflow = createWorkflow();

  assert.equal(
    workflow.getTranscriptSourceUrl('https://www.youtube.com/shorts/abc123'),
    'https://www.youtube.com/shorts/abc123'
  );
  assert.equal(
    workflow.getTranscriptSourceUrl('https://www.youtube.com/watch?v=abc123'),
    'https://www.youtube.com/watch?v=abc123'
  );
});

test('createTranscriptWorkflow prefers InnerTube entries and falls back to timedtext entries', async () => {
  let timedTextCalls = 0;
  const innerTubeWorkflow = createWorkflow({
    fetchInnerTubeTranscript: async () => [['0:01', 'InnerTube line']],
    fetchTimedTextTranscript: async () => {
      timedTextCalls += 1;
      return [['0:02', 'Timed text line']];
    },
  });

  const innerTubePackage = await innerTubeWorkflow.extractTranscriptPackage();
  assert.deepEqual(innerTubePackage.entries, [['0:01', 'InnerTube line']]);
  assert.equal(innerTubePackage.body, '0:01: InnerTube line');
  assert.equal(timedTextCalls, 0);

  const timedTextWorkflow = createWorkflow({
    extractPlayerResponse: () => ({ id: 'player-response' }),
    fetchInnerTubeTranscript: async () => [],
    fetchTimedTextTranscript: async () => [['0:02', 'Timed text line']],
  });

  const timedTextPackage = await timedTextWorkflow.extractTranscriptPackage();
  assert.deepEqual(timedTextPackage.entries, [['0:02', 'Timed text line']]);
  assert.equal(timedTextPackage.body, '0:02: Timed text line');
});

test('createTranscriptWorkflow supports per-run sourceUrl and displayUrl overrides', async () => {
  const fetchHtmlCalls = [];
  const videoIdCalls = [];
  const workflow = createWorkflow({
    fetchHtml: async (url) => {
      fetchHtmlCalls.push(url);
      return '<html></html>';
    },
    getVideoIdFromUrl: (url) => {
      videoIdCalls.push(url);
      return new URL(url).searchParams.get('v');
    },
    fetchTimedTextTranscript: async (_playerResponse, videoId) => [[`id:${videoId}`, 'Timed text line']],
  });

  const transcriptPackage = await workflow.extractTranscriptPackage({
    sourceUrl: 'https://www.youtube.com/watch?v=source-123',
    displayUrl: 'https://www.youtube.com/watch?v=display-456',
  });

  assert.deepEqual(fetchHtmlCalls, ['https://www.youtube.com/watch?v=source-123']);
  assert.deepEqual(videoIdCalls, ['https://www.youtube.com/watch?v=source-123']);
  assert.equal(transcriptPackage.url, 'https://www.youtube.com/watch?v=display-456');
  assert.equal(transcriptPackage.body, 'id:source-123: Timed text line');
});

test('createTranscriptWorkflow throws when InnerTube and timedtext both return no entries', async () => {
  const workflow = createWorkflow({
    fetchInnerTubeTranscript: async () => [],
    fetchTimedTextTranscript: async () => [],
  });

  await assert.rejects(
    workflow.extractTranscriptPackage({
      sourceUrl: 'https://www.youtube.com/watch?v=video-123',
      displayUrl: 'https://www.youtube.com/watch?v=video-123',
    }),
    /No captions found/
  );
});

test('createTranscriptWorkflow capturePotToken uses the injected caption toggle finder', async () => {
  let clickCount = 0;
  let clickListener = null;
  let listenerStarted = false;
  const captionToggleButton = {
    addEventListener(eventName, listener) {
      if (eventName === 'click') {
        clickListener = listener;
      }
    },
    click() {
      clickCount += 1;

      if (!listenerStarted && clickListener) {
        listenerStarted = true;
        void clickListener();
      }
    },
  };
  const workflow = createTranscriptWorkflow({
    TranscriptCore: require('../transcript-core.js'),
    documentRef: {},
    performanceRef: {
      clearResourceTimings() {},
      getEntriesByType(type) {
        if (type !== 'resource' || clickCount < 2) {
          return [];
        }

        return [
          {
            name: 'https://www.youtube.com/api/timedtext?v=video-123&pot=token-123',
          },
        ];
      },
    },
    findCaptionToggleButton: () => captionToggleButton,
    getVideoIdFromUrl: () => 'video-123',
    navigatorRef: { clipboard: { writeText: async () => {} } },
    resolvePageData: () => ({ title: 'Resolved Title' }),
    waitForMilliseconds: async () => {},
  });

  const token = await workflow.capturePotToken('video-123');

  assert.equal(token, 'token-123');
  assert.equal(clickCount, 2);
});

test('createTranscriptWorkflow formats clipboard text as title, URL, blank line, body', () => {
  const workflow = createWorkflow();

  assert.equal(
    workflow.buildClipboardText({
      title: 'Video title',
      url: 'https://www.youtube.com/watch?v=video-123',
      body: '0:01: first line',
    }),
    'Video title\nhttps://www.youtube.com/watch?v=video-123\n\n0:01: first line'
  );
});
