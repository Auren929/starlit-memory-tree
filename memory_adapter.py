"""Small, backend-independent memory contract for the standalone tree."""

from __future__ import annotations

import importlib
import json
import os
from pathlib import Path
from typing import Any, Protocol


class MemoryAdapter(Protocol):
    def list_memories(self) -> list[dict[str, Any]]: ...

    def get_memory(self, memory_id: str) -> dict[str, Any] | None: ...

    def get_edges(self) -> dict[str, Any]: ...


def normalize_memory(raw: dict[str, Any]) -> dict[str, Any]:
    """Map a source record to the tree's stable public schema."""
    if not isinstance(raw, dict):
        raise ValueError("memory must be an object")
    memory_id = str(raw.get("id") or "").strip()
    if not memory_id or len(memory_id) > 256:
        raise ValueError("memory.id must be a nonempty stable ID (max 256 chars)")
    name = str(raw.get("name") or raw.get("title") or "一颗记忆")
    content = str(raw.get("content") or raw.get("body") or "")
    importance = raw.get("importance", 5)
    try:
        importance = max(0, min(10, int(importance)))
    except (TypeError, ValueError):
        importance = 5
    stage = str(raw.get("stage") or "")
    if stage not in {"", "seed", "fruit", "archived", "removed"}:
        stage = ""
    tags = raw.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    return {
        "id": memory_id,
        "name": name[:240],
        "preview": str(raw.get("preview") or content[:500])[:500],
        "content": content,
        "created": str(raw.get("created") or "")[:32],
        "domain": str(raw.get("domain") or "未分类")[:80],
        "importance": importance,
        "pinned": bool(raw.get("pinned", False)),
        "tags": [str(tag)[:80] for tag in tags[:12]],
        "stage": stage,
        "ring_angle": raw.get("ring_angle"),
        "ring_tier": raw.get("ring_tier"),
        "anim_pending": None,
    }


class JsonFileAdapter:
    """Read a local JSON file. Suitable for demos and personal exports."""

    def __init__(self, path: str | Path):
        self.path = Path(path)

    def list_memories(self) -> list[dict[str, Any]]:
        with self.path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        records = payload.get("memories") if isinstance(payload, dict) else payload
        if not isinstance(records, list):
            raise ValueError("memory file must contain a list or {\"memories\": [...]} ")
        result = [normalize_memory(record) for record in records]
        ids = [record["id"] for record in result]
        if len(ids) != len(set(ids)):
            raise ValueError("memory IDs must be unique")
        return result

    def get_memory(self, memory_id: str) -> dict[str, Any] | None:
        return next((record for record in self.list_memories() if record["id"] == memory_id), None)

    def get_edges(self) -> dict[str, Any]:
        return {}


def load_adapter() -> MemoryAdapter:
    spec = os.environ.get("TREE_ADAPTER", "").strip()
    if not spec:
        return JsonFileAdapter(Path(__file__).parent / "demo" / "memories.json")
    if spec.startswith("json:"):
        return JsonFileAdapter(spec[5:])
    if ":" not in spec:
        raise ValueError("TREE_ADAPTER must be json:/path or module:factory")
    module_name, factory_name = spec.split(":", 1)
    factory = getattr(importlib.import_module(module_name), factory_name)
    return factory()


def grouped_memories(records: list[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        if record["stage"] == "removed":
            continue
        groups.setdefault(record["domain"], []).append(record)
    return {
        "galaxies": [
            {"key": name, "label": name, "color": "#b8caff", "count": len(items), "stars": items}
            for name, items in groups.items()
        ],
        "total": sum(len(items) for items in groups.values()),
    }
