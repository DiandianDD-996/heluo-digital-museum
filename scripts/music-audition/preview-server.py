"""Local audition server with byte ranges for reliable native audio seeking."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re


DEFAULT_DIRECTORY = Path(__file__).resolve().parents[2] / "artifacts/music-audition-2026-09-27"


class AuditionHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "HeluoAudition/1.0"

    def send_head(self):
        self.remaining = None
        path = Path(self.translate_path(self.path))
        if not path.is_file():
            return super().send_head()
        try:
            stream = path.open("rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        try:
            size = path.stat().st_size
            modified = self.date_time_string(path.stat().st_mtime)
            start, end = 0, size - 1
            requested = self.headers.get("Range")
            if_range = self.headers.get("If-Range")
            if if_range and if_range != modified:
                requested = None
            if requested:
                match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested.strip())
                valid = bool(match and any(match.groups()) and size > 0)
                if valid:
                    first, last = match.groups()
                    if first:
                        start = int(first)
                        end = min(int(last), size - 1) if last else size - 1
                    else:
                        suffix = int(last)
                        start = max(0, size - suffix)
                        valid = suffix > 0
                    valid = valid and 0 <= start <= end < size
                if not valid:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.send_header("Accept-Ranges", "bytes")
                    self.end_headers()
                    stream.close()
                    return None
            self.send_response(206 if requested else 200)
            self.send_header("Content-Type", self.guess_type(str(path)))
            self.send_header("Content-Length", str(max(0, end - start + 1)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Last-Modified", modified)
            # Source files are iterated locally; always revalidate a new load.
            self.send_header("Cache-Control", "no-cache")
            if requested:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            stream.seek(start)
            self.remaining = max(0, end - start + 1)
            return stream
        except Exception:
            stream.close()
            raise

    def copyfile(self, source, outputfile):
        try:
            if self.remaining is None:
                return super().copyfile(source, outputfile)
            left = self.remaining
            while left > 0:
                chunk = source.read(min(left, 64 * 1024))
                if not chunk:
                    break
                outputfile.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            # Changing tracks can cancel an in-flight range request normally.
            pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4197)
    parser.add_argument("--directory", type=Path, default=DEFAULT_DIRECTORY)
    args = parser.parse_args()
    directory = args.directory.resolve()
    if not directory.is_dir():
        parser.error("The rendered audition directory does not exist")
    if not 1024 <= args.port <= 65535:
        parser.error("Use a local unprivileged port between 1024 and 65535")
    handler = partial(AuditionHandler, directory=str(directory))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Audition ready at http://127.0.0.1:{args.port}/?revision=r3 (byte ranges enabled)", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
