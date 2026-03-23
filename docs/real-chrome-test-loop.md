# Real Chrome Test Loop

This document describes the reusable test loop for validating the YouTube homepage hover behavior in a real Chrome session.

The goal is to let future agents test the extension against the user's actual browser state instead of a separate headless browser.

## When To Use This Loop

Use this loop when:

- the feature depends on real YouTube homepage behavior
- the user explicitly asks to test in their current Chrome window
- hover timing, preview players, or extension injection differ from a clean headless run

Do not replace this with a headless test when the user has asked for the real browser.

## Preconditions

Before starting, confirm:

1. Chrome is already running.
2. Chrome has remote debugging enabled.
   In Chrome, open `chrome://inspect/#remote-debugging` and enable `Allow remote debugging for this browser instance`.
3. The extension is loaded unpacked in that Chrome profile.
4. `browser-use` is available in the local environment.

## Core Principle

Treat the real browser as the source of truth.

For YouTube homepage hover testing, a synthetic `browser-use hover <index>` may be insufficient. Prefer a low-level mouse move through the connected page object when you need the actual preview player to appear.

## Session Setup

Create or reuse a named session connected to the user's real Chrome:

```bash
browser-use sessions
browser-use --session real open https://www.youtube.com/
```

If a `real` session already exists, reuse it instead of opening a new browser.

You can inspect the current tabs with:

```bash
browser-use --session real python 'tabs = browser._run(browser._session.get_tabs()); print([(i, tab.url, tab.title) for i, tab in enumerate(tabs)])'
```

This is important because tab indices may change during the session.

## Standard Verification Loop

Run this loop after every relevant code change.

### 1. Reload the extension in `chrome://extensions/`

Switch to the extensions tab:

```bash
browser-use --session real switch <extensions-tab-index>
browser-use --session real eval 'location.href'
```

Reload the unpacked extension by clicking its `Reload` button through shadow DOM:

```bash
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
    aria: reloadButton.getAttribute("aria-label"),
    name: item?.shadowRoot?.querySelector("#name")?.textContent?.trim() || null,
  };
})()'
```

Expected result:

- `clicked: true`

### 2. Reload the YouTube homepage

Switch back to the YouTube tab:

```bash
browser-use --session real switch <youtube-tab-index>
browser-use --session real eval 'location.href'
```

Reload the page:

```bash
browser-use --session real eval 'location.reload(); "reloading"'
sleep 2
```

The `sleep` is a pragmatic wait for the homepage to stabilize.

### 3. Trigger a real hover on the video thumbnail

Do not rely on `browser-use hover <index>` for this scenario. Use the connected page object and move the real mouse pointer into the thumbnail area.

Example:

```bash
browser-use --session real python 'import time
page = browser._run(browser._session.get_current_page())
mouse = browser._run(page.mouse)
browser._run(mouse.move(250, 200))
time.sleep(1.0)
print("hovered")
'
```

Notes:

- The coordinates must land inside the thumbnail area, not the text metadata below it.
- If the preview does not appear, adjust coordinates.
- Waiting about `0.8` to `1.2` seconds is usually enough for the preview controls to render.

### 4. Inspect the hover controls DOM

Query the visible top-right hover controls:

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
    children: controls
      ? Array.from(controls.children).map((el) => ({
          cls: el.className || null,
          injected: el.getAttribute("data-yt-home-transcript-button"),
          title: el.querySelector("button")?.getAttribute("title"),
          aria: el.querySelector("button")?.getAttribute("aria-label"),
        }))
      : [],
  };
}"""))
print(result)
'
```

Expected success signal:

- `hasControls: true`
- `childCount: 3`
- one child with `data-yt-home-transcript-button="true"`
- that child's button title should be `Copy transcript`

### 5. Capture a screenshot in the same hover session

Keep the hover alive and capture the screenshot inside the same Python session when possible:

```bash
browser-use --session real python 'import time
page = browser._run(browser._session.get_current_page())
mouse = browser._run(page.mouse)
browser._run(mouse.move(250, 200))
time.sleep(1.0)
print(browser.screenshot("/absolute/path/to/.tmp-real-hover-check.png"))
'
```

This is important because a separate command may lose the hover state before the screenshot is taken.

## Known YouTube-Specific Findings

These details matter for this repository.

### The visible hover controls are not the bottom YTP controls

On the current YouTube homepage, the visible hover button group is the top-right inline preview control cluster:

```text
yt-inline-player-controls .ytInlinePlayerControlsTopRightControls
```

Do not assume the visible homepage hover buttons live in:

```text
#inline-preview-player .ytp-right-controls
#inline-preview-player .ytp-right-controls-left
```

That assumption was wrong in real Chrome testing.

### The controls may be siblings of `#inline-preview-player`

The preview video element and the visible control cluster can be separate nodes under the preview host. If DOM queries are scoped only to `#inline-preview-player.querySelector(...)`, the real controls may not be found.

Prefer document-level lookup for the hover controls cluster when validating or debugging.

### Clone the native circle-button structure

If the extension needs to inject alongside mute and captions, cloning the native `ytInlinePlayerControlsTopRightControlsCircleButton` structure is more reliable than rendering a separate overlay or forcing a generic `ytp-button`.

## Practical Debugging Checklist

If the user says they still cannot see the button:

1. Verify the extension was actually reloaded in `chrome://extensions/`.
2. Verify the YouTube tab was reloaded after the extension reload.
3. Verify the hover coordinates are inside the thumbnail, not the metadata area.
4. Verify the preview controls appear in the real screenshot.
5. Verify `.ytInlinePlayerControlsTopRightControls` exists during hover.
6. Verify the injected node is present in that container.
7. If the DOM shows the injected node but the user still cannot see it, inspect CSS inheritance and stacking.

## Suggested Agent Output After Each Loop

When reporting results, include:

- whether the extension was reloaded in the real Chrome session
- whether the YouTube tab was reloaded
- whether hover produced the preview controls
- the current child count of `.ytInlinePlayerControlsTopRightControls`
- whether an injected node is present
- the path to the screenshot used as evidence

Example:

```text
Reloaded extension in chrome://extensions/.
Reloaded the YouTube homepage in the real Chrome tab.
Hover controls appeared.
.ytInlinePlayerControlsTopRightControls child count: 3.
Injected node present with title "Copy transcript".
Screenshot: /absolute/path/to/.tmp-real-hover-check.png
```

## Cleanup

Temporary screenshots used during debugging should not be committed.

Common pattern:

```bash
git status --short
```

If `.tmp-*.png` files were created for debugging, leave them untracked or remove them before committing code.

## Minimal Command Set

For quick reuse, this is the minimal practical sequence:

```bash
browser-use --session real python 'tabs = browser._run(browser._session.get_tabs()); print([(i, tab.url, tab.title) for i, tab in enumerate(tabs)])'
browser-use --session real switch <extensions-tab-index>
browser-use --session real eval '(() => { const itemList = document.querySelector("extensions-manager")?.shadowRoot?.querySelector("extensions-item-list")?.shadowRoot; const item = Array.from(itemList?.querySelectorAll("extensions-item") || []).find((candidate) => { const name = candidate.shadowRoot?.querySelector("#name")?.textContent?.trim()?.toLowerCase() || ""; return name.includes("get youtube transcription"); }); const reloadButton = item?.shadowRoot?.querySelector("#dev-reload-button"); if (!reloadButton) return { clicked: false }; reloadButton.click(); return { clicked: true, name: item?.shadowRoot?.querySelector("#name")?.textContent?.trim() || null }; })()'
browser-use --session real switch <youtube-tab-index>
browser-use --session real eval 'location.reload(); "reloading"'
sleep 2
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
    children: controls ? Array.from(controls.children).map((el) => ({
      injected: el.getAttribute("data-yt-home-transcript-button"),
      title: el.querySelector("button")?.getAttribute("title"),
    })) : [],
  };
}"""))
print(result)
print(browser.screenshot("/absolute/path/to/.tmp-real-hover-check.png"))
'
```
