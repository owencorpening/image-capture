#!/usr/bin/env python3
"""
Image watch script — monitors ~/Downloads/ and routes camelCase image files
to ~/dev/images/[SECTION]/[imageName]/ based on ~/.image-watch-config.

Config format:
  SECTION=water-series/part-09

On each image, the watcher also looks for a matching [imageName].meta.json
sidecar (downloaded by the bookmarklet) and writes url.txt, license.txt,
and photographer.txt into the destination folder, then deletes the json.
"""

import json
import os
import re
import shutil
import time
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

DOWNLOADS_DIR = Path.home() / "Downloads"
CONFIG_FILE   = Path.home() / ".image-watch-config"
IMAGES_BASE   = Path.home() / "dev" / "images"
LOG_FILE      = Path.home() / "dev" / "wraith" / "substack-ideas" / "image-watch.log"

# Starts with a lowercase letter, pure camelCase base, optional -crop-/-anim- suffix, image ext.
CAMEL_RE = re.compile(
    r'^[a-z][a-zA-Z0-9]+'
    r'(?:-(?:crop|anim)-[a-zA-Z0-9x.\-]+)?'
    r'\.(jpg|jpeg|png|webp|gif|svg|html)$'
)

META_RE = re.compile(r'^[a-z][a-zA-Z0-9]+\.meta\.json$')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)


def read_config():
    if not CONFIG_FILE.exists():
        return None
    cfg = {}
    for line in CONFIG_FILE.read_text().splitlines():
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, _, v = line.partition('=')
            cfg[k.strip()] = v.strip()
    return cfg.get('SECTION')


def destination_dir(image_stem: str, section: str) -> Path:
    return IMAGES_BASE / section / image_stem


def wait_for_file_stable(path: Path, timeout=10) -> bool:
    """Return True once file size stops changing (write complete)."""
    deadline = time.time() + timeout
    prev_size = -1
    while time.time() < deadline:
        try:
            size = path.stat().st_size
        except FileNotFoundError:
            return False
        if size == prev_size and size > 0:
            return True
        prev_size = size
        time.sleep(0.5)
    return False


def write_provenance(dest_dir: Path, meta: dict):
    if meta.get('url'):
        (dest_dir / 'url.txt').write_text(meta['url'])
    if meta.get('license'):
        (dest_dir / 'license.txt').write_text(meta['license'])
    photographer = meta.get('photographer', '')
    if photographer and photographer != 'UNKNOWN':
        (dest_dir / 'photographer.txt').write_text(photographer)
    log.info("PROVENANCE written in %s", dest_dir)


def handle_meta_file(path: Path):
    """Meta arrived — if the image is already in its destination, write provenance there."""
    if not wait_for_file_stable(path):
        return

    stem = path.name[: -len('.meta.json')]
    section = read_config()
    if not section:
        return

    dest_dir = destination_dir(stem, section)
    if dest_dir.exists():
        try:
            meta = json.loads(path.read_text())
            write_provenance(dest_dir, meta)
            path.unlink()
        except Exception as e:
            log.warning("Failed to write late provenance for %s: %s", stem, e)
    # If dest doesn't exist yet, leave the json — the image handler will pick it up.


def handle_image_file(path: Path):
    filename = path.name
    if not CAMEL_RE.match(filename):
        return

    section = read_config()
    if not section:
        log.warning("SKIP %s — no SECTION set in %s", filename, CONFIG_FILE)
        return

    if not wait_for_file_stable(path):
        return

    stem    = filename.rsplit('.', 1)[0]
    dest_dir = destination_dir(stem, section)
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest = dest_dir / filename
    if dest.exists():
        base, ext = filename.rsplit('.', 1)
        dest = dest_dir / f"{base}-1.{ext}"

    shutil.move(str(path), dest)
    log.info("MOVED  %s  →  %s", path, dest)

    meta_path = DOWNLOADS_DIR / (stem + '.meta.json')
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
            write_provenance(dest_dir, meta)
            meta_path.unlink()
        except Exception as e:
            log.warning("Failed to read meta for %s: %s", stem, e)


def handle_new_file(path: Path):
    filename = path.name
    if META_RE.match(filename):
        handle_meta_file(path)
    else:
        handle_image_file(path)


class DownloadsHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        handle_new_file(Path(event.src_path))

    def on_moved(self, event):
        # Browsers often write to a .crdownload/.part then rename on completion.
        if event.is_directory:
            return
        handle_new_file(Path(event.dest_path))


def main():
    DOWNLOADS_DIR.mkdir(exist_ok=True)
    log.info("Watching %s", DOWNLOADS_DIR)

    observer = Observer()
    observer.schedule(DownloadsHandler(), str(DOWNLOADS_DIR), recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
