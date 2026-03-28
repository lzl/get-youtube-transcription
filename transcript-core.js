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

  function readTitleFromData(data) {
    for (const readTitle of TITLE_READERS) {
      const title = readTitle(data);

      if (title) {
        return title;
      }
    }

    return null;
  }

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
    return readTitleFromData(data) || 'Untitled Video';
  }

  function resolvePageData(html) {
    let initialData = null;

    try {
      initialData = extractJsonBlob(html, 'ytInitialData');
      const initialDataTitle = readTitleFromData(initialData);

      if (initialDataTitle) {
        return {
          resolvedType: 'regular',
          sourceKey: 'ytInitialData',
          data: initialData,
          title: initialDataTitle,
        };
      }
    } catch (error) {
      initialData = null;
    }

    try {
      const playerResponse = extractJsonBlob(html, 'ytInitialPlayerResponse');

      return {
        resolvedType: 'shorts',
        sourceKey: 'ytInitialPlayerResponse',
        data: playerResponse,
        title: getTitleFromData(playerResponse),
      };
    } catch (error) {
      return {
        resolvedType: 'regular',
        sourceKey: 'ytInitialData',
        data: initialData,
        title: getTitleFromData(initialData),
      };
    }
  }

  function getCaptionBaseUrl(playerResponse) {
    return playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0]?.baseUrl || null;
  }

  function decodeJsonStringValue(value) {
    if (typeof value !== 'string') {
      return null;
    }

    try {
      return JSON.parse(`"${value}"`);
    } catch (error) {
      return value;
    }
  }

  function getInnertubeApiKey(html) {
    if (typeof html !== 'string' || !html) {
      return null;
    }

    const patterns = [
      /"INNERTUBE_API_KEY":"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"innertubeApiKey":"([^"\\]*(?:\\.[^"\\]*)*)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match?.[1]) {
        return decodeJsonStringValue(match[1]);
      }
    }

    return null;
  }

  function selectCaptionTrack(captionTracks) {
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      return null;
    }

    return (
      captionTracks.find((track) => track?.baseUrl && track.kind !== 'asr') ||
      captionTracks.find((track) => track?.baseUrl) ||
      null
    );
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
        return readJson3TranscriptSegment(segment);
      })
      .filter((entry) => entry && entry[1]);
  }

  function getXmlAttribute(tag, name) {
    const needle = `${name}="`;
    const start = tag.indexOf(needle);

    if (start === -1) {
      return '';
    }

    const valueStart = start + needle.length;
    const valueEnd = tag.indexOf('"', valueStart);

    if (valueEnd === -1) {
      return '';
    }

    return tag.slice(valueStart, valueEnd);
  }

  function decodeHtmlEntities(text) {
    return String(text || '')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
  }

  function parseCaptionXml(xml) {
    if (typeof xml !== 'string' || !xml) {
      return [];
    }

    const isFormat3 = xml.includes('<p ');
    const marker = isFormat3 ? '<p ' : '<text ';
    const endMarker = isFormat3 ? '</p>' : '</text>';
    const results = [];
    let position = 0;

    while (true) {
      const tagStart = xml.indexOf(marker, position);

      if (tagStart === -1) {
        break;
      }

      let contentStart = xml.indexOf('>', tagStart);

      if (contentStart === -1) {
        break;
      }

      contentStart += 1;
      const tagEnd = xml.indexOf(endMarker, contentStart);

      if (tagEnd === -1) {
        break;
      }

      const attributes = xml.slice(tagStart + marker.length, contentStart - 1);
      const content = xml.slice(contentStart, tagEnd);
      const startMilliseconds = isFormat3
        ? parseFloat(getXmlAttribute(attributes, 't')) || 0
        : (parseFloat(getXmlAttribute(attributes, 'start')) || 0) * 1000;
      const text = normalizeText(decodeHtmlEntities(content.replace(/<[^>]+>/g, '')));

      if (text) {
        results.push([formatMillisecondsAsTimestamp(startMilliseconds), text]);
      }

      position = tagEnd + endMarker.length;
    }

    return results;
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
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      const normalizedHostname = hostname.replace(/^www\./, '');

      if (normalizedHostname === 'youtu.be') {
        return parsedUrl.pathname.slice(1).split('/')[0] || null;
      }

      if (!normalizedHostname.endsWith('youtube.com')) {
        return null;
      }

      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v');
      }

      const pathMatch = parsedUrl.pathname.match(/^\/(shorts|embed|live|v)\/([^/?]+)/);

      if (pathMatch?.[2]) {
        return pathMatch[2];
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  return {
    buildTimedTextUrl,
    extractJsonBlob,
    formatMillisecondsAsTimestamp,
    getCaptionBaseUrl,
    getInnertubeApiKey,
    getTitleFromData,
    getVideoIdFromUrl,
    normalizeTranscriptSegments,
    parseCaptionXml,
    resolvePageData,
    selectCaptionTrack,
  };
});
