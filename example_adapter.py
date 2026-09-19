"""Example integration point for another memory store.

Copy this file, then set TREE_ADAPTER=your_module:create_adapter.
The returned object must implement list_memories(), get_memory(id), get_edges().
Keep source credentials on the server; never expose them to browser JavaScript.
"""

from pathlib import Path

from memory_adapter import JsonFileAdapter


def create_adapter():
    # Replace this with an adapter to your own database or memory API.
    return JsonFileAdapter(Path(__file__).parent / "demo" / "memories.json")
