const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

test('homepage preview transcript button uses white icons and loading spinner styles', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');

  assert.match(
    css,
    /\.yt-home-transcript-player-button button\s*\{[\s\S]*background:\s*transparent\s*;[\s\S]*color:\s*#(?:fff|ffffff)\s*;/i
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
    /\.ytInlinePlayerControlsTopRightControlsCircleButton\.yt-home-transcript-player-button\[data-state="success"\]\s*\{[\s\S]*box-shadow:\s*inset 0 0 0 1px #86efac !important\s*;/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button\[data-state="success"\]\s*\{[\s\S]*background:\s*transparent\s*;[\s\S]*color:\s*#86efac\s*;/i
  );
  assert.match(
    css,
    /\.ytInlinePlayerControlsTopRightControlsCircleButton\.yt-home-transcript-player-button\[data-state="no_transcript"\]\s*\{[\s\S]*box-shadow:\s*inset 0 0 0 1px #fcd34d !important\s*;/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button\[data-state="no_transcript"\]\s*\{[\s\S]*background:\s*transparent\s*;[\s\S]*color:\s*#fcd34d\s*;/i
  );
  assert.match(
    css,
    /\.ytInlinePlayerControlsTopRightControlsCircleButton\.yt-home-transcript-player-button\[data-state="error"\]\s*\{[\s\S]*box-shadow:\s*inset 0 0 0 1px #fca5a5 !important\s*;/i
  );
  assert.match(
    css,
    /\.yt-home-transcript-player-button button\[data-state="error"\]\s*\{[\s\S]*background:\s*transparent\s*;[\s\S]*color:\s*#fca5a5\s*;/i
  );
});
