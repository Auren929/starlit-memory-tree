"""Standalone development server for the memory tree. No private service required."""

from __future__ import annotations

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from memory_adapter import grouped_memories, load_adapter, normalize_memory


ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
STATE = ROOT / ".runtime"
ADAPTER = load_adapter()
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("model/gltf-binary", ".glb")


def records():
    result = [normalize_memory(item) for item in ADAPTER.list_memories()]
    ids = [item["id"] for item in result]
    if len(ids) != len(set(ids)):
        raise ValueError("memory IDs must be unique")
    return result


class TreeHandler(BaseHTTPRequestHandler):
    def _json(self, value, status=200):
        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _file(self, path: Path):
        if not path.is_file():
            return self.send_error(404)
        payload = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _state(self):
        path = STATE / "branch-prune.json"
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            return {"cuts": [], "thin": 0}

    def do_GET(self):
        path = urlsplit(self.path).path
        try:
            if path in ("/", "/starmap"):
                return self._file(ROOT / "templates" / "starmap_pick.html")
            if path == "/api/starmap":
                return self._json(grouped_memories(records()))
            if path.startswith("/api/starmap/star/"):
                memory_id = unquote(path[len("/api/starmap/star/"):])
                if not memory_id or len(memory_id) > 256 or any(ord(ch) < 32 for ch in memory_id):
                    return self._json({"error": "invalid memory ID"}, 400)
                record = ADAPTER.get_memory(memory_id)
                record = normalize_memory(record) if record else None
                if not record or record["id"] != memory_id:
                    return self._json({"error": "not found"}, 404)
                return self._json({"content": record["content"]})
            if path == "/api/worldtree/edges":
                return self._json({"edges": ADAPTER.get_edges(), "why": {}})
            if path == "/api/starmap/branch-prune":
                return self._json(self._state())
            if path == "/api/starmap/lifecycle":
                memories = {r["id"]: {"stage": r["stage"]} for r in records()}
                return self._json({"demo": False, "memories": memories})
            if path == "/api/starmap/events":
                self.send_response(204)
                self.end_headers()
                return
            if path == "/api/models":
                return self._json({"models": [], "default": None})
            if path == "/api/stickers":
                return self._json({})
            if path == "/api/starmap/client-log":
                return self._json({"lines": []})
            if path.startswith("/static/"):
                target = (STATIC / unquote(path[len("/static/"):])).resolve()
                if not target.is_relative_to(STATIC.resolve()):
                    return self.send_error(403)
                return self._file(target)
            return self.send_error(404)
        except Exception as exc:
            self.log_error("request failed: %s", exc)
            return self._json({"error": "memory source unavailable"}, 500)

    def do_POST(self):
        path = urlsplit(self.path).path
        if path in ("/api/starmap/lifecycle/sync", "/api/starmap/anim-done", "/api/starmap/client-log"):
            return self._json({"ok": True})
        if path == "/api/starmap/branch-prune":
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size < 0 or size > 128_000:
                    return self._json({"error": "request too large"}, 413)
                body = json.loads(self.rfile.read(size))
                cuts = body.get("cuts", [])
                if not isinstance(cuts, list):
                    return self._json({"error": "cuts must be a list"}, 400)
                cuts = [str(c) for c in cuts[:4000] if isinstance(c, str) and len(c) <= 32]
                thin = max(0.0, min(0.85, float(body.get("thin", 0))))
                value = {"cuts": cuts, "thin": thin}
                STATE.mkdir(exist_ok=True)
                (STATE / "branch-prune.json").write_text(json.dumps(value), encoding="utf-8")
                return self._json({"ok": True, **value})
            except (ValueError, TypeError):
                return self._json({"error": "invalid JSON"}, 400)
        return self._json({"error": "this standalone tree does not include chat or uploads"}, 404)


if __name__ == "__main__":
    host = os.environ.get("TREE_HOST", "127.0.0.1")
    port = int(os.environ.get("TREE_PORT", "8765"))
    print(f"Memory tree: http://{host}:{port}/starmap", flush=True)
    ThreadingHTTPServer((host, port), TreeHandler).serve_forever()
