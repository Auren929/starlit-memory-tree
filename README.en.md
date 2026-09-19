# Starlit Memory Tree — standalone candidate

This is an **offline extraction candidate**, not a public release. It keeps the current tree scene but does not include the private chat service or real memory data.

## Run locally

Requires Python 3.9+ and a modern browser with WebGL 2. No Python packages are required.

```sh
python3 server.py
```

Open `http://127.0.0.1:8765/starmap`. Try the chat deep-link contract with `http://127.0.0.1:8765/starmap?star=demo-rainy-walk`.

The demo contains four fictional memories. Runtime branch-pruning settings stay in `.runtime/` and are excluded from source control. "Visitor mode" only masks text in the current browser; it is **not** a security boundary for private memory APIs.

## Connect your memory library

`TREE_ADAPTER` selects a server-side adapter. The built-in file adapter accepts a JSON list or `{ "memories": [...] }`:

```sh
TREE_ADAPTER=json:/absolute/path/to/my-memories.json python3 server.py
```

Each memory must have a **stable unique string `id`**. Optional fields: `name`/`title`, `content`/`body`, `preview`, `created` (`YYYY-MM-DD`), `domain`, `importance` (0–10), `pinned`, `tags`, and `stage` (`seed`, `fruit`, `archived`, `removed`). Never derive the ID from the record's array position: sorting and editing would break chat links.

For a database or HTTP API, implement `list_memories()`, `get_memory(id)`, and `get_edges()` in a Python class and provide a factory via `TREE_ADAPTER=your_module:create_adapter`. See `example_adapter.py`. Keep provider keys in server-side environment variables; do not put them in the browser bundle.

## Chat → tree integration

When a chat response reports which memories were actually recalled, retain their IDs with that response, for example `{"recalled":[{"id":"memory-123","name":"A memory"}]}`. Render links with `?star=<URL-encoded stable ID>`. `chat_link.js` offers an optional helper and sets `rel="noopener noreferrer"` for new tabs. The standalone tree works without chat; chat is not bundled here.

## Current release boundary

Run this candidate only on localhost. It has no user authentication. Do **not** expose it on a public interface or publish this directory as-is: add authentication first. The project is licensed CC BY-NC 4.0 (see LICENSE). The original production tree and private data are untouched.

Credits are kept in [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md): **baci** for the original Memory Galaxy architectural inspiration, and a separate credit for the **Tree GN** 3D model by Node_λrt (@Node_Art), CC BY 4.0. These credits do not assert a license or permission to reuse the tutorial's code or assets.

Run checks with `python3 -m unittest discover -s tests` and `node --test tests/test_chat_link.mjs` (Node is only needed for the optional chat-link test).
