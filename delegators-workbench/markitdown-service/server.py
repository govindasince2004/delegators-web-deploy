"""MarkItDown conversion sidecar for the Delegators Workbench.

Single job: accept an uploaded file's bytes and return token-efficient Markdown
using Microsoft's MarkItDown (https://github.com/microsoft/markitdown). The
Workbench TS server calls this over the private compose network; it is never
exposed publicly and holds no credentials.

Protocol (deliberately stdlib-simple):
  GET  /healthz                          -> {"ok": true}
  POST /convert  (body = raw file bytes) -> {"ok": true, "markdown": "..."}
       headers: X-Filename (required, used for type detection)
Errors return {"ok": false, "error": "..."} with a 4xx/5xx status; the caller
falls back to its built-in extractors, so a failure here never breaks a run.
"""

import io
import json
import os
import pathlib
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from markitdown import MarkItDown

MAX_BYTES = int(os.environ.get("MARKITDOWN_MAX_BYTES", str(32 * 1024 * 1024)))
PORT = int(os.environ.get("MARKITDOWN_PORT", "8490"))

# MarkItDown instances are reusable; plugins stay off so the conversion surface
# is exactly the audited built-in converters.
_converter = MarkItDown(enable_plugins=False)
_lock = threading.Lock()


def _convert(payload: bytes, filename: str) -> str:
    extension = pathlib.PurePosixPath(filename).suffix.lower() or None
    with _lock:
        result = _converter.convert_stream(io.BytesIO(payload), file_extension=extension)
    return result.text_content or ""


class Handler(BaseHTTPRequestHandler):
    server_version = "delegators-markitdown/1.0"

    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802 (http.server API)
        if self.path == "/healthz":
            self._send(200, {"ok": True, "service": "markitdown"})
            return
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 (http.server API)
        if self.path != "/convert":
            self._send(404, {"ok": False, "error": "not found"})
            return
        filename = self.headers.get("X-Filename", "").strip()
        if not filename:
            self._send(400, {"ok": False, "error": "X-Filename header is required"})
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BYTES:
            self._send(413, {"ok": False, "error": f"body must be 1..{MAX_BYTES} bytes"})
            return
        payload = self.rfile.read(length)
        try:
            markdown = _convert(payload, filename)
        except Exception as error:  # noqa: BLE001 - report any converter failure to the caller
            self._send(422, {"ok": False, "error": f"conversion failed: {error}"})
            return
        self._send(200, {"ok": True, "markdown": markdown})

    def log_message(self, fmt: str, *args) -> None:  # quiet structured-ish logging
        print(json.dumps({"msg": fmt % args, "client": self.client_address[0]}), flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(json.dumps({"msg": f"markitdown sidecar listening on :{PORT}"}), flush=True)
    server.serve_forever()
