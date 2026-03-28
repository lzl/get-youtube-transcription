# AGENTS.md

## Repo Overview

This repository is a Manifest V3 Chrome extension for YouTube.

It injects transcript actions across multiple YouTube surfaces:

- `watch`
- `live`
- `shorts`
- list and hover-driven surfaces such as the homepage and other video grids

Automated regression coverage runs with:

```bash
node --test
```

## Git and Commits

When you are asked to create a commit, use a conventional commit message.

- Prefer standard prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, or `perf:`.
- Keep the subject concise and specific to the actual change.
- Split unrelated work into separate commits instead of combining them under one message.

## Default Testing Strategy

Prefer local inspection and `node --test` first.

Use the real Chrome test loop only when unit tests and static inspection are not enough to prove behavior in the user's actual browser environment. This is a fallback debugging and integration workflow, not a mandatory step for every UI change.

Good candidates for the real Chrome loop:

- real-browser DOM differences
- extension reload state
- content-script injection timing
- page transition handling
- hover or inline preview behavior
- shadow DOM interaction
- clipboard behavior
- CSS visibility, stacking, or inherited styling issues
- any case where the user explicitly asks for validation in their current Chrome session

Do not reach for the real Chrome loop first when the change is limited to pure parsing, URL handling, transcript formatting, or other logic already covered by `node --test`.

## Real Chrome Test Loop

### Preconditions

Before starting, confirm all of the following:

1. Chrome is already running.
2. Remote debugging is enabled for that browser instance in `chrome://inspect/#remote-debugging`.
3. The unpacked extension is loaded in that same Chrome profile.
4. `browser-use` is available in the local environment.

### Session Setup

Use a reusable named session called `real` when possible.

- Reuse the existing session if it is already attached to the user's Chrome.
- Keep one tab open for `chrome://extensions/`.
- Keep another tab open for the target YouTube surface you are testing.
- Always list tabs before switching because tab indices can drift during a session.

Tab listing template:

```bash
browser-use --session real python 'tabs = browser._run(browser._session.get_tabs()); print([(i, tab.url, tab.title) for i, tab in enumerate(tabs)])'
```

### Standard Verification Loop

Run this loop after each relevant code change when browser reality matters.

1. Identify the target surface: `watch`, `live`, `shorts`, homepage/list hover, or another list surface.
2. Switch to the `chrome://extensions/` tab and reload the unpacked extension.
3. Switch back to the target YouTube tab, reload it, and allow a short stabilization wait.
4. Perform the real interaction that matches the issue:
   - use a real click for `watch`, `live`, or `shorts`
   - use low-level mouse movement through the connected page object for hover or preview behavior
5. Inspect the DOM, accessibility state, or visible control cluster that matches the surface under test. Choose selectors based on the surface you are debugging.
6. Capture a screenshot as evidence. For transient hover states, capture the screenshot in the same command or session that keeps the state alive.
7. Report the fixed facts listed in the reporting checklist below.

### Command Templates

Reload the extension in `chrome://extensions/`:

```bash
browser-use --session real switch <extensions-tab-index>
browser-use --session real eval '(() => {
  const itemList = document.querySelector("extensions-manager")
    ?.shadowRoot?.querySelector("extensions-item-list")
    ?.shadowRoot;
  const item = Array.from(itemList?.querySelectorAll("extensions-item") || []).find((candidate) => {
    const name = candidate.shadowRoot?.querySelector("#name")?.textContent?.trim()?.toLowerCase() || "";
    return name.includes("get youtube transcription");
  });
  const reloadButton = item?.shadowRoot?.querySelector("#dev-reload-button");
  if (!reloadButton) return { clicked: false };
  reloadButton.click();
  return {
    clicked: true,
    name: item?.shadowRoot?.querySelector("#name")?.textContent?.trim() || null,
    aria: reloadButton.getAttribute("aria-label"),
  };
})()'
```

Reload the target YouTube tab:

```bash
browser-use --session real switch <youtube-tab-index>
browser-use --session real eval 'location.href'
browser-use --session real eval 'location.reload(); "reloading"'
sleep 2
```

Generic real-interaction, DOM-check, and screenshot template:

```bash
browser-use --session real python 'import time
page = browser._run(browser._session.get_current_page())

# Optional: use one of these interaction styles depending on the surface.
# mouse = browser._run(page.mouse)
# browser._run(mouse.move(250, 200))
# browser._run(mouse.click(250, 200))

time.sleep(1.0)

result = browser._run(page.evaluate("""() => {
  const selectors = {
    watchButton: "button[aria-label*='Transcript'], button[title*='Transcript']",
    shortsAction: "ytd-reel-video-renderer button[aria-label*='Transcript']",
    hoverCluster: ".ytInlinePlayerControlsTopRightControls",
  };

  return {
    url: location.href,
    watchButtonFound: Boolean(document.querySelector(selectors.watchButton)),
    shortsActionFound: Boolean(document.querySelector(selectors.shortsAction)),
    hoverClusterFound: Boolean(document.querySelector(selectors.hoverCluster)),
  };
}"""))

print(result)
print(browser.screenshot("/absolute/path/to/.tmp-real-check.png"))
'
```

Example: list-preview or hover debugging:

```bash
browser-use --session real python 'import time
page = browser._run(browser._session.get_current_page())
mouse = browser._run(page.mouse)
browser._run(mouse.move(250, 200))
time.sleep(1.0)
result = browser._run(page.evaluate("""() => {
  const controls = document.querySelector(".ytInlinePlayerControlsTopRightControls");
  return {
    hasControls: Boolean(controls),
    childCount: controls ? controls.children.length : 0,
    hasInjectedNode: Boolean(
      controls?.querySelector("[data-yt-list-transcript-button=\"true\"]")
    ),
  };
}"""))
print(result)
print(browser.screenshot("/absolute/path/to/.tmp-real-hover-check.png"))
'
```

### Surface-Specific Inspection Guidance

Pick selectors and signals based on the surface you are validating.

- `watch` or `live`: inspect the main transcript button, its accessible name, loading state, success state, and any clipboard or notification feedback tied to the primary action area.
- `shorts`: inspect the Shorts action bar placement, ordering relative to native actions, and accessible state after interaction.
- list hover or inline preview: inspect the visible preview control cluster, injected node presence, hover timing, and whether the button inherits the expected native structure and styling.

Do not assume one selector covers every surface.

### Project-Specific Notes

These details matter in this repository during real-browser debugging:

- `browser-use hover <index>` may be insufficient for real inline preview behavior. Prefer a low-level mouse move through the connected page object when the preview must actually appear.
- Visible hover controls may live in `.ytInlinePlayerControlsTopRightControls`, not in the bottom YTP control containers.
- Document-level lookup can be more reliable than scoping strictly inside `#inline-preview-player` because the visible control cluster may live outside that subtree.

### Reporting Checklist

When reporting a real Chrome loop result, always include:

- whether the extension was reloaded in `chrome://extensions/`
- whether the YouTube tab was reloaded
- which surface was tested
- which interaction was performed
- which selectors or signals were checked
- the screenshot path used as evidence
- the final pass or fail conclusion

Example report:

```text
Reloaded the unpacked extension in chrome://extensions/.
Reloaded the target YouTube tab.
Surface tested: homepage list hover.
Interaction performed: low-level mouse move into the thumbnail preview region.
Checked selectors/signals: .ytInlinePlayerControlsTopRightControls, [data-yt-list-transcript-button="true"].
Screenshot: /absolute/path/to/.tmp-real-hover-check.png
Conclusion: pass
```

## Cleanup

Temporary screenshots created during debugging should remain untracked and must not be committed.
