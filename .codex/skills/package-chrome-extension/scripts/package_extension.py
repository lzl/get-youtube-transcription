#!/usr/bin/env python3

import json
import re
import sys
import zipfile
from pathlib import Path


WILDCARD_CHARS = "*?["


def find_repo_root() -> Path:
    current = Path(__file__).resolve().parent
    for path in [current, *current.parents]:
        if (path / "manifest.json").exists():
            return path
    raise FileNotFoundError("Could not find repo root with manifest.json")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug) or "chrome-extension"


def add_file_ref(targets: set[str], value) -> None:
    if isinstance(value, str) and value.strip():
        targets.add(value.strip())


def add_many(targets: set[str], values) -> None:
    if isinstance(values, list):
        for value in values:
            add_file_ref(targets, value)


def add_icon_refs(targets: set[str], value) -> None:
    if isinstance(value, str):
        add_file_ref(targets, value)
    elif isinstance(value, dict):
        for item in value.values():
            add_file_ref(targets, item)


def collect_targets(manifest: dict) -> set[str]:
    targets: set[str] = {"manifest.json"}

    for content_script in manifest.get("content_scripts", []):
        if isinstance(content_script, dict):
            add_many(targets, content_script.get("js"))
            add_many(targets, content_script.get("css"))

    for resource_block in manifest.get("web_accessible_resources", []):
        if isinstance(resource_block, dict):
            add_many(targets, resource_block.get("resources"))

    add_icon_refs(targets, manifest.get("icons"))

    background = manifest.get("background", {})
    if isinstance(background, dict):
        add_file_ref(targets, background.get("service_worker"))
        add_many(targets, background.get("scripts"))
        add_file_ref(targets, background.get("page"))

    for action_key in ("action", "browser_action", "page_action"):
        action = manifest.get(action_key, {})
        if isinstance(action, dict):
            add_file_ref(targets, action.get("default_popup"))
            add_icon_refs(targets, action.get("default_icon"))

    add_file_ref(targets, manifest.get("options_page"))

    options_ui = manifest.get("options_ui", {})
    if isinstance(options_ui, dict):
        add_file_ref(targets, options_ui.get("page"))

    add_file_ref(targets, manifest.get("devtools_page"))

    sandbox = manifest.get("sandbox", {})
    if isinstance(sandbox, dict):
        add_many(targets, sandbox.get("pages"))

    side_panel = manifest.get("side_panel", {})
    if isinstance(side_panel, dict):
        add_file_ref(targets, side_panel.get("default_path"))

    chrome_url_overrides = manifest.get("chrome_url_overrides", {})
    if isinstance(chrome_url_overrides, dict):
        for item in chrome_url_overrides.values():
            add_file_ref(targets, item)

    return targets


def expand_target(root: Path, target: str) -> list[str]:
    if any(char in target for char in WILDCARD_CHARS):
        matches = [path for path in root.glob(target) if path.is_file()]
        return sorted(path.relative_to(root).as_posix() for path in matches)

    path = root / target
    if path.is_file():
        return [path.relative_to(root).as_posix()]
    if path.is_dir():
        return sorted(
            item.relative_to(root).as_posix()
            for item in path.rglob("*")
            if item.is_file()
        )
    return []


def resolve_files(root: Path, targets: set[str]) -> tuple[list[str], list[str]]:
    files: set[str] = set()
    missing: list[str] = []

    for target in sorted(targets):
        matched_files = expand_target(root, target)
        if matched_files:
            files.update(matched_files)
        else:
            missing.append(target)

    locales_dir = root / "_locales"
    if locales_dir.is_dir():
        files.update(
            item.relative_to(root).as_posix()
            for item in locales_dir.rglob("*")
            if item.is_file()
        )

    return sorted(files), missing


def build_zip(root: Path, files: list[str], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_name in files:
            archive.write(root / file_name, arcname=file_name)


def main() -> int:
    try:
        root = find_repo_root()
        manifest_path = root / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    targets = collect_targets(manifest)
    files, missing = resolve_files(root, targets)
    if missing:
        print("ERROR: Missing files referenced by manifest:", file=sys.stderr)
        for item in missing:
            print(f"- {item}", file=sys.stderr)
        return 1

    version = str(manifest.get("version", "0.0.0"))
    name = str(manifest.get("name", "chrome-extension"))
    slug = slugify(name)
    output_path = root / "release" / f"{slug}-v{version}.zip"

    try:
        build_zip(root, files, output_path)
    except Exception as exc:
        print(f"ERROR: Could not create zip: {exc}", file=sys.stderr)
        return 1

    print(f"Version: {version}")
    print(f"Zip: {output_path}")
    print("Files:")
    for file_name in files:
        print(f"- {file_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
