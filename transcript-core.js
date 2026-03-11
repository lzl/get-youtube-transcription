(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TranscriptCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TITLE_READERS = [
    (data) => data?.videoDetails?.title,
    (data) => data?.playerOverlays?.playerOverlayRenderer?.videoDetails?.playerOverlayVideoDetailsRenderer?.title?.simpleText,
    (data) => data?.microformat?.playerMicroformatRenderer?.title?.simpleText,
  ];

  function readBalancedObject(source, objectStart) {
    let depth = 0;
    let inString = false;
    let stringQuote = '';
    let escaped = false;

    for (let index = objectStart; index < source.length; index += 1) {
      const character = source[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (inString) {
        if (character === '\\') {
          escaped = true;
        } else if (character === stringQuote) {
          inString = false;
        }

        continue;
      }

      if (character === '"' || character === "'") {
        inString = true;
        stringQuote = character;
        continue;
      }

      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;

        if (depth === 0) {
          return source.slice(objectStart, index + 1);
        }
      }
    }

    return null;
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function findAssignmentStart(source, key) {
    const escapedKey = escapeRegExp(key);
    const patterns = [
      new RegExp(`window\\s*\\[\\s*["']${escapedKey}["']\\s*\\]\\s*=\\s*\\{`, 'g'),
      new RegExp(`(?:var|let|const)\\s+${escapedKey}\\s*=\\s*\\{`, 'g'),
      new RegExp(`(?:^|[;\\s])${escapedKey}\\s*=\\s*\\{`, 'g'),
    ];

    return patterns.reduce((earliestObjectStart, pattern) => {
      const match = pattern.exec(source);

      if (!match) {
        return earliestObjectStart;
      }

      const objectStart = match.index + match[0].lastIndexOf('{');

      if (earliestObjectStart === -1 || objectStart < earliestObjectStart) {
        return objectStart;
      }

      return earliestObjectStart;
    }, -1);
  }

  function extractJsonBlob(source, key) {
    const objectStart = findAssignmentStart(source, key);

    if (objectStart === -1) {
      throw new Error(`${key} not found`);
    }

    const jsonText = readBalancedObject(source, objectStart);

    if (!jsonText) {
      throw new Error(`Unable to parse ${key}`);
    }

    return JSON.parse(jsonText);
  }

  function getTitleFromData(data) {
    for (const readTitle of TITLE_READERS) {
      const title = readTitle(data);

      if (title) {
        return title;
      }
    }

    return 'Untitled Video';
  }

  function resolvePageData(html) {
    try {
      const initialData = extractJsonBlob(html, 'ytInitialData');

      return {
        resolvedType: 'regular',
        sourceKey: 'ytInitialData',
        data: initialData,
        title: getTitleFromData(initialData),
      };
    } catch (error) {
      const playerResponse = extractJsonBlob(html, 'ytInitialPlayerResponse');

      return {
        resolvedType: 'shorts',
        sourceKey: 'ytInitialPlayerResponse',
        data: playerResponse,
        title: getTitleFromData(playerResponse),
      };
    }
  }

  function getCaptionBaseUrl(playerResponse) {
    return playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0]?.baseUrl || null;
  }

  function formatMillisecondsAsTimestamp(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function normalizeText(text) {
    return (text || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function readPanelTranscriptSegment(segment) {
    const renderer = segment?.transcriptSegmentRenderer;

    if (!renderer) {
      return null;
    }

    return [
      renderer.startTimeText?.simpleText || '',
      normalizeText((renderer.snippet?.runs || []).map((run) => run.text || '').join('')),
    ];
  }

  function readModernTranscriptSegment(segment) {
    const renderer = segment?.transcriptSegmentViewModel;

    if (!renderer) {
      return null;
    }

    return [renderer.timestamp || '', normalizeText(renderer.simpleText)];
  }

  function readJson3TranscriptSegment(segment) {
    if (!segment?.segs) {
      return null;
    }

    return [
      formatMillisecondsAsTimestamp(segment.tStartMs || 0),
      normalizeText(segment.segs.map((part) => part.utf8 || '').join('')),
    ];
  }

  function normalizeTranscriptSegments(segments) {
    if (!Array.isArray(segments)) {
      return [];
    }

    return segments
      .map((segment) => {
        return (
          readPanelTranscriptSegment(segment) ||
          readModernTranscriptSegment(segment) ||
          readJson3TranscriptSegment(segment)
        );
      })
      .filter((entry) => entry && entry[1]);
  }

  function buildTimedTextUrl(baseUrl, potToken) {
    if (!baseUrl) {
      return null;
    }

    const url = new URL(baseUrl);
    url.searchParams.set('fmt', 'json3');

    if (potToken) {
      url.searchParams.set('pot', potToken);
      url.searchParams.set('c', 'WEB');
    }

    return url.toString();
  }

  function getVideoIdFromUrl(url) {
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname.startsWith('/shorts/')) {
      return parsedUrl.pathname.split('/shorts/')[1].split('/')[0];
    }

    if (parsedUrl.pathname === '/watch') {
      return parsedUrl.searchParams.get('v');
    }

    return null;
  }

  return {
    buildTimedTextUrl,
    extractJsonBlob,
    formatMillisecondsAsTimestamp,
    getCaptionBaseUrl,
    getTitleFromData,
    getVideoIdFromUrl,
    normalizeTranscriptSegments,
    resolvePageData,
  };
});
