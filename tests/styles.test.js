const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

test('homepage preview transcript button defines calm hover, focus, and loading affordances', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');

  assert.match(
    css,
    /\.yt-home-transcript-player-button button\s*\{[\s\S]*background:\s*rgba\([^)]+\)[\s\S]*color:\s*rgba\([^)]+\)[\s\S]*transition:[\s\S]*transform/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button:hover[\s\S]*transform:\s*translateY\(-1px\)\s*scale\(1\.0[23]\)/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button:focus-visible[\s\S]*box-shadow:[\s\S]*0 0 0 2px/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button:active[\s\S]*transform:\s*scale\(0\.9[67]\)/i
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
    /\.yt-home-transcript-player-button\[data-state="success"\][\s\S]*button[\s\S]*color:\s*#bbf7d0/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="success"\][\s\S]*box-shadow:[\s\S]*#bbf7d0/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="no_transcript"\][\s\S]*button[\s\S]*color:\s*#fde68a/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="no_transcript"\][\s\S]*box-shadow:[\s\S]*#fde68a/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="error"\][\s\S]*button[\s\S]*color:\s*#fecaca/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="error"\][\s\S]*box-shadow:[\s\S]*#fecaca/i
  );
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.yt-home-transcript-player-button button[\s\S]*transition:\s*none !important[\s\S]*animation-duration:\s*0\.01ms/i
  );
});
