import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import ProxyHandler, build_opener

from server import TreeHandler


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), TreeHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"
        cls.opener = build_opener(ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_list_and_full_text_contract(self):
        with self.opener.open(self.base + "/api/starmap") as response:
            data = json.load(response)
        self.assertEqual(data["total"], 4)
        with self.opener.open(self.base + "/api/starmap/star/demo-rainy-walk") as response:
            data = json.load(response)
        self.assertIn("雨停后", data["content"])

    def test_missing_id_is_404(self):
        with self.assertRaises(HTTPError) as context:
            self.opener.open(self.base + "/api/starmap/star/not-there")
        self.assertEqual(context.exception.code, 404)

    def test_private_file_not_served(self):
        with self.assertRaises(HTTPError) as context:
            self.opener.open(self.base + "/static/%2e%2e/demo/memories.json")
        self.assertIn(context.exception.code, (403, 404))


if __name__ == "__main__":
    unittest.main()
