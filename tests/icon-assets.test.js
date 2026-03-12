const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

test('icon.svg uses the transcript tile badge structure', () => {
  const svg = fs.readFileSync(path.join(repoRoot, 'icon.svg'), 'utf8');

  assert.doesNotMatch(svg, /<circle\b/i);
  assert.equal(
    svg.includes('<rect id="badge" x="16" y="16" width="96" height="96" rx="22" fill="#D63A2F"/>'),
    true
  );
  assert.equal(
    svg.includes('<path id="card" d="M43 36H84C88.4183 36 92 39.5817 92 44V53.5L82 64L92 74.5V84C92 88.4183 88.4183 92 84 92H43C38.5817 92 35 88.4183 35 84V44C35 39.5817 38.5817 36 43 36Z" fill="#FFF6F1"/>'),
    true
  );
  assert.equal(svg.includes('<rect id="line-1" x="49" y="49" width="24" height="7" rx="3.5" fill="#D63A2F"/>'), true);
  assert.equal(svg.includes('<rect id="line-2" x="49" y="61" width="31" height="7" rx="3.5" fill="#D63A2F"/>'), true);
  assert.equal(svg.includes('<rect id="line-3" x="49" y="73" width="20" height="7" rx="3.5" fill="#D63A2F"/>'), true);
});
