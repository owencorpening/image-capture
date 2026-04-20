#!/usr/bin/env python3
"""
Image watch script — monitors ~/Downloads/ and routes camelCase image files
to the correct series folder based on ~/.image-watch-config.
"""

import os
import re
import shutil
import time
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

DOWNLOADS_DIR   = Path.home() / "Downloads"
CONFIG_FILE     = Path.home() / ".image-watch-config"
SERIES_BASE     = Path.home() / "dev" / "wraith" / "substack-ideas"
LOG_FILE        = SERIES_BASE / "image-watch.log"

# Starts with a lowercase letter, pure camelCase base, optional -crop-/-anim- suffix, image ext.
CAMEL_RE = re.compile(
    r'^[a-z][a-zA-Z0-9]+'
    r'(?:-(?:crop|anim)-[a-zA-Z0-9x.\-]+)?'
    r'\.(jpg|jpeg|png|webp|gif)$'
)

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
        return None, None
    cfg = {}
    for line in CONFIG_FILE.read_text().splitlines():
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, _, v = line.partition('=')
            cfg[k.strip()] = v.strip()
    return cfg.get('SERIES'), cfg.get('PART')


def destination_dir(filename: str, series: str) -> Path:
    base = SERIES_BASE / f"series-{series}" / "images"
    if '-anim-' in filename:
        return base / "animations"
    if '-crop-table' in filename:
        return base / "tables"
    if '-crop-' in filename:
        return base / "covers"
    return base


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


def handle_new_file(path: Path):
    filename = path.name
    if not CAMEL_RE.match(filename):
        return

    series, part = read_config()
    if not series:
        log.warning("SKIP %s — no SERIES set in %s", filename, CONFIG_FILE)
        return

    if not wait_for_file_stable(path):
        return

    dest_dir = destination_dir(filename, series)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / filename

    if dest.exists():
        stem, suffix = filename.rsplit('.', 1)
        dest = dest_dir / f"{stem}-1.{suffix}"

    shutil.move(str(path), dest)
    log.info("MOVED  %s  →  %s", path, dest)


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
