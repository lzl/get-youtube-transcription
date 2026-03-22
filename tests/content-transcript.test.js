const test = require('node:test');
const assert = require('node:assert/strict');

const { createTranscriptWorkflow } = require('../content-transcript.js');

function createWorkflow(overrides = {}) {
  return createTranscriptWorkflow({
    fetchHtml: async () => '<html></html>',
    fetchTimedTextTranscript: async () => [],
    fetchTranscriptFromPanel: async () => [],
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

test('createTranscriptWorkflow prefers timedtext entries and falls back to panel entries', async () => {
  const timedTextWorkflow = createWorkflow({
    extractPlayerResponse: () => ({ id: 'player-response' }),
    fetchTimedTextTranscript: async () => [['0:01', 'Timed text line']],
    fetchTranscriptFromPanel: async () => [['0:02', 'Panel line']],
  });

  const timedTextPackage = await timedTextWorkflow.extractTranscriptPackage();
  assert.deepEqual(timedTextPackage.entries, [['0:01', 'Timed text line']]);
  assert.equal(timedTextPackage.body, '0:01: Timed text line');

  const panelWorkflow = createWorkflow({
    fetchTranscriptFromPanel: async () => [['0:02', 'Panel line']],
  });

  const panelPackage = await panelWorkflow.extractTranscriptPackage();
  assert.deepEqual(panelPackage.entries, [['0:02', 'Panel line']]);
  assert.equal(panelPackage.body, '0:02: Panel line');
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

test('createTranscriptWorkflow skips transcript panel fallback when allowPanelFallback is false', async () => {
  let panelFallbackCalls = 0;
  const workflow = createWorkflow({
    fetchTimedTextTranscript: async () => [],
    fetchTranscriptFromPanel: async () => {
      panelFallbackCalls += 1;
      return [['0:02', 'Panel line']];
    },
  });

  await assert.rejects(
    workflow.extractTranscriptPackage({
      sourceUrl: 'https://www.youtube.com/watch?v=video-123',
      displayUrl: 'https://www.youtube.com/watch?v=video-123',
      allowPanelFallback: false,
    }),
    /No captions found/
  );

  assert.equal(panelFallbackCalls, 0);
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
