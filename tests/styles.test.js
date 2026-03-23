const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

test('homepage preview transcript button keeps the native transparent feel and full-button interactivity', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');

  assert.match(
    css,
    /\.yt-home-transcript-player-button button\s*\{[\s\S]*width:\s*100%[\s\S]*height:\s*100%[\s\S]*background:\s*transparent[\s\S]*color:\s*#(?:fff|ffffff)/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button:hover\s*\{[\s\S]*background:\s*transparent/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button:active\s*\{[\s\S]*background:\s*transparent/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button:focus-visible[\s\S]*outline:\s*none/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button:disabled svg\s*\{[\s\S]*animation:\s*spin 1s linear infinite\s*;/i
  );
});

test('homepage preview transcript button defines success, no_transcript, and error visual states', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');

  assert.match(
    css,
    /\.yt-home-transcript-player-button button\[data-state="success"\]\s*\{[\s\S]*background:\s*transparent\s*;[\s\S]*color:\s*#86efac/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button\[data-state="success"\] svg\s*\{[\s\S]*transform:\s*none/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button\[data-state="no_transcript"\]\s*\{[\s\S]*background:\s*transparent\s*;[\s\S]*color:\s*#fcd34d/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button\[data-state="error"\]\s*\{[\s\S]*background:\s*transparent\s*;[\s\S]*color:\s*#fca5a5/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\s+button\[data-state=\"success\"\]:hover[\s\S]*background:\s*transparent/i
  );
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.yt-home-transcript-player-button button[\s\S]*transition:\s*none !important[\s\S]*animation-duration:\s*0\.01ms/i
  );
});
