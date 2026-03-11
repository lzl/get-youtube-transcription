(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TranscriptContentWorkflow = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const globalRoot = typeof globalThis !== 'undefined' ? globalThis : this;

  function formatTranscriptText(entries) {
    return entries
      .map(([timestamp, text]) => {
        return timestamp ? `${timestamp}: ${text}` : text;
      })
      .join('\n');
  }

  function buildClipboardText(transcriptPackage) {
    return `${transcriptPackage.title}\n${transcriptPackage.url}\n\n${transcriptPackage.body}`;
  }

  function getTranscriptSourceUrl(currentUrl, getVideoIdFromUrl) {
    const parsedUrl = new URL(currentUrl);

    if (!parsedUrl.pathname.startsWith('/shorts/')) {
      return currentUrl;
    }

    const videoId = getVideoIdFromUrl(currentUrl);

    if (!videoId) {
      throw new Error('Could not determine Shorts video ID');
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function createTranscriptWorkflow(overrides = {}) {
    const {
      TranscriptCore,
      capturePotToken,
      documentRef,
      extractPlayerResponse,
      fetchHtml,
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalRoot) : null,
      fetchTimedTextTranscript,
      fetchTranscriptFromPanel,
      findTranscriptPanelButton,
      getCurrentUrl = () => '',
      getPageTitle = () => 'Unknown Title',
      getVideoIdFromUrl,
      navigatorRef,
      performanceRef,
      potTokens = new Map(),
      readTranscriptEntriesFromSegmentNodes,
      resolvePageData,
      transcriptSegmentSelector,
      waitForMilliseconds = (milliseconds) => {
        return new Promise((resolve) => {
          setTimeout(resolve, milliseconds);
        });
      },
      waitForSelector,
    } = overrides;

    async function fetchHtmlImpl(url) {
      if (fetchHtml) {
        return fetchHtml(url);
      }

      if (!fetchImpl) {
        throw new Error('Fetch API is not available');
      }

      const response = await fetchImpl(url, {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch YouTube page (${response.status})`);
      }

      return response.text();
    }

    async function capturePotTokenImpl(videoId) {
      if (capturePotToken) {
        return capturePotToken(videoId);
      }

      const cacheKey = `yt-caption-potoken-${videoId || ''}`;

      if (potTokens.has(cacheKey)) {
        return potTokens.get(cacheKey);
      }

      const subtitlesButton = documentRef?.querySelector(
        '#movie_player button.ytp-subtitles-button, #movie_player .ytp-right-controls-left button.ytp-subtitles-button'
      );

      if (!subtitlesButton || !performanceRef) {
        return '';
      }

      try {
        performanceRef.clearResourceTimings();

        const tokenPromise = new Promise((resolve) => {
          subtitlesButton.addEventListener(
            'click',
            async () => {
              for (let index = 0; index <= 500; index += 50) {
                await waitForMilliseconds(50);

                const timedTextEntry = performanceRef
                  .getEntriesByType('resource')
                  .filter((entry) => entry.name.includes('/api/timedtext?'))
                  .pop();

                if (!timedTextEntry) {
                  continue;
                }

                const token = new URL(timedTextEntry.name).searchParams.get('pot');

                if (token) {
                  potTokens.set(cacheKey, token);
                  resolve(token);
                  return;
                }
              }

              resolve('');
            },
            { once: true }
          );
        });

        subtitlesButton.click();
        subtitlesButton.click();

        const token = await Promise.race([
          tokenPromise,
          waitForMilliseconds(600).then(() => ''),
        ]);

        if (token) {
          potTokens.set(cacheKey, token);
        }

        return token || '';
      } catch (error) {
        console.warn('POT token capture failed:', error);
        return '';
      }
    }

    async function fetchTimedTextTranscriptImpl(playerResponse, videoId) {
      if (fetchTimedTextTranscript) {
        return fetchTimedTextTranscript(playerResponse, videoId);
      }

      const baseUrl = TranscriptCore.getCaptionBaseUrl(playerResponse);

      if (!baseUrl) {
        return [];
      }

      const potToken = await capturePotTokenImpl(videoId);
      const timedTextUrl = TranscriptCore.buildTimedTextUrl(baseUrl, potToken);

      if (!timedTextUrl) {
        return [];
      }

      try {
        const response = await fetchImpl(timedTextUrl, {
          credentials: 'same-origin',
        });

        if (!response.ok) {
          return [];
        }

        const payload = await response.json();
        return TranscriptCore.normalizeTranscriptSegments(payload.events);
      } catch (error) {
        console.warn('Timedtext transcript fetch failed:', error);
        return [];
      }
    }

    async function fetchTranscriptFromPanelImpl() {
      if (fetchTranscriptFromPanel) {
        return fetchTranscriptFromPanel();
      }

      const transcriptButton = await findTranscriptPanelButton?.();

      if (!transcriptButton || !transcriptSegmentSelector || !documentRef) {
        return [];
      }

      transcriptButton.click();

      const hasSegments = await waitForSelector(transcriptSegmentSelector, 3000);

      if (!hasSegments) {
        return [];
      }

      await waitForMilliseconds(300);

      return readTranscriptEntriesFromSegmentNodes(documentRef.querySelectorAll(transcriptSegmentSelector));
    }

    async function extractTranscriptPackage() {
      const sourceUrl = getTranscriptSourceUrlImpl();
      const html = await fetchHtmlImpl(sourceUrl);
      const pageData = resolvePageData(html);

      let playerResponse = null;

      try {
        playerResponse = (extractPlayerResponse || ((source) => {
          return TranscriptCore.extractJsonBlob(source, 'ytInitialPlayerResponse');
        }))(html);
      } catch (error) {
        playerResponse = null;
      }

      const videoId = getVideoIdFromUrl(sourceUrl);
      let transcriptEntries = await fetchTimedTextTranscriptImpl(playerResponse, videoId);

      if (!transcriptEntries.length) {
        transcriptEntries = await fetchTranscriptFromPanelImpl();
      }

      if (!transcriptEntries.length) {
        throw new Error('No captions found. This video may not have a transcript available.');
      }

      return {
        title: pageData.title || getPageTitle(),
        url: getCurrentUrl(),
        body: formatTranscriptText(transcriptEntries),
        entries: transcriptEntries,
      };
    }

    function getTranscriptSourceUrlImpl(url = getCurrentUrl()) {
      return getTranscriptSourceUrl(url, getVideoIdFromUrl);
    }

    async function copyTextToClipboard(transcriptPackage) {
      const formattedText = buildClipboardText(transcriptPackage);

      try {
        await navigatorRef.clipboard.writeText(formattedText);
      } catch (error) {
        const textArea = documentRef.createElement('textarea');
        textArea.value = formattedText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        documentRef.body.appendChild(textArea);
        textArea.select();
        documentRef.execCommand('copy');
        documentRef.body.removeChild(textArea);
      }
    }

    return {
      buildClipboardText,
      capturePotToken: capturePotTokenImpl,
      copyTextToClipboard,
      extractTranscriptPackage,
      fetchHtml: fetchHtmlImpl,
      fetchTimedTextTranscript: fetchTimedTextTranscriptImpl,
      fetchTranscriptFromPanel: fetchTranscriptFromPanelImpl,
      formatTranscriptText,
      getTranscriptSourceUrl: getTranscriptSourceUrlImpl,
    };
  }

  return {
    buildClipboardText,
    createTranscriptWorkflow,
    formatTranscriptText,
    getTranscriptSourceUrl,
  };
});
