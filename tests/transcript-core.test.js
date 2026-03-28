const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../transcript-core.js');

test('extractJsonBlob parses embedded ytInitialPlayerResponse objects', () => {
  assert.equal(typeof core.extractJsonBlob, 'function');

  const html = `
    <script>
      var ytInitialPlayerResponse = {"videoDetails":{"title":"Demo"},"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc"}]}}};
    </script>
  `;

  const result = core.extractJsonBlob(html, 'ytInitialPlayerResponse');

  assert.equal(result.videoDetails.title, 'Demo');
  assert.equal(
    result.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl,
    'https://www.youtube.com/api/timedtext?v=abc'
  );
});

test('extractJsonBlob prefers real ytInitialPlayerResponse assignment over later references', () => {
  const html = `
    <script>
      var ytInitialPlayerResponse = {"videoDetails":{"title":"Assigned Title"},"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=assigned"}]}}};
      window['ytInitialPlayerResponse'];
      (function playerBootstrap() {
        if (window.ytplayer.bootstrapPlayerResponse) {
          window.ytplayer.config = {args:{raw_player_response:window.ytplayer.bootstrapPlayerResponse}};
        }
      })();
    </script>
  `;

  const result = core.extractJsonBlob(html, 'ytInitialPlayerResponse');

  assert.equal(result.videoDetails.title, 'Assigned Title');
  assert.equal(
    result.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl,
    'https://www.youtube.com/api/timedtext?v=assigned'
  );
});

test('resolvePageData prefers ytInitialData title without exposing transcript endpoint metadata', () => {
  assert.equal(typeof core.resolvePageData, 'function');

  const html = `
    <script>
      var ytInitialData = {
        "engagementPanels": [
          {
            "engagementPanelSectionListRenderer": {
              "content": {
                "continuationItemRenderer": {
                  "continuationEndpoint": {
                    "getTranscriptEndpoint": {
                      "params": "panel-params"
                    }
                  }
                }
              }
            }
          }
        ],
        "videoDetails": {
          "title": "Panel Transcript"
        }
      };
      var ytInitialPlayerResponse = {
        "videoDetails": {
          "title": "Fallback Player"
        }
      };
    </script>
  `;

  const result = core.resolvePageData(html);

  assert.equal(result.resolvedType, 'regular');
  assert.equal(result.title, 'Panel Transcript');
  assert.equal(result.sourceKey, 'ytInitialData');
  assert.deepEqual(Object.keys(result).sort(), ['data', 'resolvedType', 'sourceKey', 'title']);
});

test('TranscriptCore no longer exports transcript endpoint helpers', () => {
  assert.deepEqual(Object.keys(core).sort(), [
    'buildTimedTextUrl',
    'extractJsonBlob',
    'formatMillisecondsAsTimestamp',
    'getCaptionBaseUrl',
    'getInnertubeApiKey',
    'getTitleFromData',
    'getVideoIdFromUrl',
    'normalizeTranscriptSegments',
    'parseCaptionXml',
    'resolvePageData',
    'selectCaptionTrack',
  ]);
});

test('getInnertubeApiKey extracts the embedded YouTube InnerTube API key', () => {
  assert.equal(typeof core.getInnertubeApiKey, 'function');

  const html = `
    <script>
      ytcfg.set({"INNERTUBE_API_KEY":"api-key-123","INNERTUBE_CONTEXT_CLIENT_NAME":1});
    </script>
  `;

  assert.equal(core.getInnertubeApiKey(html), 'api-key-123');
});

test('selectCaptionTrack prefers manual tracks over ASR tracks', () => {
  assert.equal(typeof core.selectCaptionTrack, 'function');

  assert.deepEqual(core.selectCaptionTrack([
    { languageCode: 'en', kind: 'asr', baseUrl: 'https://example.com/asr' },
    { languageCode: 'en', baseUrl: 'https://example.com/manual' },
  ]), { languageCode: 'en', baseUrl: 'https://example.com/manual' });
});

test('normalizeTranscriptSegments supports json3 events', () => {
  assert.equal(typeof core.normalizeTranscriptSegments, 'function');

  const json3Events = [
    {
      tStartMs: 12000,
      segs: [{ utf8: 'first line' }, { utf8: '\nsecond line' }],
    },
  ];

  assert.deepEqual(core.normalizeTranscriptSegments(json3Events), [
    ['0:12', 'first line second line'],
  ]);
});

test('parseCaptionXml supports legacy text XML and srv3 paragraph XML', () => {
  assert.equal(typeof core.parseCaptionXml, 'function');

  assert.deepEqual(
    core.parseCaptionXml('<transcript><text start="3.0" dur="1.5">hello &amp; world</text></transcript>'),
    [['0:03', 'hello & world']]
  );

  assert.deepEqual(
    core.parseCaptionXml('<timedtext><body><p t="12000" d="800"><s>first</s><s> line</s></p></body></timedtext>'),
    [['0:12', 'first line']]
  );
});

test('buildTimedTextUrl appends json3 format and optional pot token', () => {
  assert.equal(typeof core.buildTimedTextUrl, 'function');

  assert.equal(
    core.buildTimedTextUrl('https://www.youtube.com/api/timedtext?v=abc'),
    'https://www.youtube.com/api/timedtext?v=abc&fmt=json3'
  );
  assert.equal(
    core.buildTimedTextUrl('https://www.youtube.com/api/timedtext?v=abc', 'token-1'),
    'https://www.youtube.com/api/timedtext?v=abc&fmt=json3&pot=token-1&c=WEB'
  );
});

test('getVideoIdFromUrl parses supported YouTube URL formats', () => {
  assert.equal(core.getVideoIdFromUrl('https://www.youtube.com/watch?v=abc123'), 'abc123');
  assert.equal(core.getVideoIdFromUrl('https://youtu.be/abc123'), 'abc123');
  assert.equal(core.getVideoIdFromUrl('https://www.youtube.com/shorts/abc123'), 'abc123');
  assert.equal(core.getVideoIdFromUrl('https://www.youtube.com/embed/abc123'), 'abc123');
  assert.equal(core.getVideoIdFromUrl('https://www.youtube.com/live/abc123'), 'abc123');
  assert.equal(core.getVideoIdFromUrl('https://www.youtube.com/v/abc123'), 'abc123');
});

test('getVideoIdFromUrl rejects malformed or unsupported URLs', () => {
  assert.equal(core.getVideoIdFromUrl('https://www.youtube.com/watch'), null);
  assert.equal(core.getVideoIdFromUrl('https://www.youtube.com/shorts/'), null);
  assert.equal(core.getVideoIdFromUrl('https://example.com/watch?v=abc123'), null);
});
