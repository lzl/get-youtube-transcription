---
name: package-chrome-extension
description: Package the Chrome extension in the current repository into a clean zip file for Chrome Web Store upload. Use when the user asks to package the extension, create a release zip, prepare an upload package, or build a Chrome Web Store zip from manifest.json.
---

# Package Chrome Extension

## Overview

Use this skill to create a clean upload zip for the Chrome extension in the current repo.
The skill reads `manifest.json`, runs the packaging script, and verifies the zip content.

## Workflow

1. Check that the repo root has `manifest.json`.
2. Run `python3 ./.codex/skills/package-chrome-extension/scripts/package_extension.py`.
3. Read the script output.
4. Report:
   - the extension version
   - the zip file path
   - the files inside the zip

## Rules

- Work from the current repository only.
- Use the packaging script instead of writing manual zip commands.
- Keep the package manifest-driven.
- Do not include `.git`, tests, reports, or `node_modules` unless `manifest.json` points to them.
- Fail clearly if the manifest references a missing file.

## Notes

- The script always includes `manifest.json`.
- The script also includes `_locales` files when that folder exists.
- The script collects common runtime files from standard manifest fields such as content scripts, web accessible resources, icons, background files, popup pages, options pages, devtools pages, sandbox pages, and side panel pages.
