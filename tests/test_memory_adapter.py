import json
import tempfile
import unittest
from pathlib import Path

from memory_adapter import JsonFileAdapter, grouped_memories, normalize_memory


class AdapterTests(unittest.TestCase):
    def test_normalize_stable_id_and_content(self):
        record = normalize_memory({"id": "own-记忆-7", "title": "标题", "body": "完整内容", "importance": 12})
        self.assertEqual(record["id"], "own-记忆-7")
        self.assertEqual(record["content"], "完整内容")
        self.assertEqual(record["importance"], 10)

    def test_json_adapter_and_grouping(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memories.json"
            path.write_text(json.dumps({"memories": [
                {"id": "a", "name": "A", "domain": "日常"},
                {"id": "b", "name": "B", "domain": "共创"},
            ]}, ensure_ascii=False), encoding="utf-8")
            adapter = JsonFileAdapter(path)
            self.assertEqual(adapter.get_memory("b")["name"], "B")
            self.assertIsNone(adapter.get_memory("missing"))
            self.assertEqual(grouped_memories(adapter.list_memories())["total"], 2)

    def test_duplicate_ids_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "memories.json"
            path.write_text('[{"id":"same"},{"id":"same"}]', encoding="utf-8")
            with self.assertRaises(ValueError):
                JsonFileAdapter(path).list_memories()


if __name__ == "__main__":
    unittest.main()
