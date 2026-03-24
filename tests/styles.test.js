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
  assert.match(
    css,
    /\.ytInlinePlayerControlsTopRightControlsCircleButton\.yt-home-transcript-player-button[\s\S]*\.ytInlinePlayerControlsButtonIcon[\s\S]*width:\s*100%[\s\S]*height:\s*100%/i
  );
  assert.match(
    css,
    /\.ytInlinePlayerControlsTopRightControlsCircleButton\.yt-home-transcript-player-button[\s\S]*button\s*\{[\s\S]*width:\s*100%[\s\S]*height:\s*100%/i
  );
});

test('homepage preview transcript button defines success, no_transcript, and error visual states', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');

  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="success"\]\s*button[\s\S]*background:\s*rgba\(22,\s*163,\s*74,\s*0\.14\)\s*;[\s\S]*color:\s*#166534[\s\S]*box-shadow:\s*inset 0 0 0 1px rgba\(22,\s*163,\s*74,\s*0\.18\)/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="success"\]\s*svg[\s\S]*transform:\s*scale\(0\.94\)/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="no_transcript"\]\s*button[\s\S]*background:\s*rgba\(180,\s*83,\s*9,\s*0\.14\)\s*;[\s\S]*color:\s*#9a3412[\s\S]*box-shadow:\s*inset 0 0 0 1px rgba\(180,\s*83,\s*9,\s*0\.18\)/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="error"\]\s*button[\s\S]*background:\s*rgba\(220,\s*38,\s*38,\s*0\.14\)\s*;[\s\S]*color:\s*#b91c1c[\s\S]*box-shadow:\s*inset 0 0 0 1px rgba\(220,\s*38,\s*38,\s*0\.18\)/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button\[data-state="success"\]\s*button:hover[\s\S]*background:\s*rgba\(22,\s*163,\s*74,\s*0\.18\)/i
  );
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.yt-home-transcript-player-button button[\s\S]*transition:\s*none !important[\s\S]*animation-duration:\s*0\.01ms/i
  );
});
