(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TranscriptCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function readBalancedObject(source, startIndex) {
    let depth = 0;
    let inString = false;
    let stringQuote = '';
    let escaped = false;

    for (let index = startIndex; index < source.length; index += 1) {
      const char = source[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (inString) {
        if (char === '\\') {
          escaped = true;
        } else if (char === stringQuote) {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringQuote = char;
        continue;
      }

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return source.slice(startIndex, index + 1);
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

    let earliestObjectStart = -1;

    for (const pattern of patterns) {
      const match = pattern.exec(source);
      if (!match) {
        continue;
      }

      const objectStart = match.index + match[0].lastIndexOf('{');
      if (earliestObjectStart === -1 || objectStart < earliestObjectStart) {
        earliestObjectStart = objectStart;
      }
    }

    return earliestObjectStart;
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
    return (
      data?.videoDetails?.title ||
      data?.playerOverlays?.playerOverlayRenderer?.videoDetails?.playerOverlayVideoDetailsRenderer?.title?.simpleText ||
      data?.microformat?.playerMicroformatRenderer?.title?.simpleText ||
      'Untitled Video'
    );
  }

  function resolvePageData(html) {
    let initialData = null;

    try {
      initialData = extractJsonBlob(html, 'ytInitialData');
    } catch (error) {
      initialData = null;
    }

    if (initialData) {
      return {
        resolvedType: 'regular',
        sourceKey: 'ytInitialData',
        data: initialData,
        title: getTitleFromData(initialData),
      };
    }

    const playerResponse = extractJsonBlob(html, 'ytInitialPlayerResponse');

    return {
      resolvedType: 'shorts',
      sourceKey: 'ytInitialPlayerResponse',
      data: playerResponse,
      title: getTitleFromData(playerResponse),
    };
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
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function normalizeText(text) {
    return (text || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizeTranscriptSegments(segments) {
    if (!Array.isArray(segments)) {
      return [];
    }

    return segments
      .map((segment) => {
        if (segment?.transcriptSegmentRenderer) {
          const renderer = segment.transcriptSegmentRenderer;
          const text = normalizeText(
            (renderer.snippet?.runs || []).map((run) => run.text || '').join('')
          );

          return [renderer.startTimeText?.simpleText || '', text];
        }

        if (segment?.transcriptSegmentViewModel) {
          const renderer = segment.transcriptSegmentViewModel;
          return [renderer.timestamp || '', normalizeText(renderer.simpleText)];
        }

        if (segment?.segs) {
          return [
            formatMillisecondsAsTimestamp(segment.tStartMs || 0),
            normalizeText(segment.segs.map((part) => part.utf8 || '').join('')),
          ];
        }

        return null;
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
    const parsed = new URL(url);

    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.split('/shorts/')[1].split('/')[0];
    }

    if (parsed.pathname === '/watch') {
      return parsed.searchParams.get('v');
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
