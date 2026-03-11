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
