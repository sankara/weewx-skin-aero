---
description: How to generate Aero skin data and start a debug server
---

1. Ensure dependencies are installed (first run only):
   ```bash
   uv sync
   ```

2. Generate the report (JSON files) using the test database:
   ```bash
   uv run aero-build --db test-data/weewx.sdb --output public_html
   ```

3. Start a local HTTP server to host the `public_html` directory:
   ```bash
   uv run python3 -m http.server 8000 --directory public_html
   ```

4. Open your browser to internal URL (or equivalent port forwarding):
   http://localhost:8000

5. For subsequent run, you can use the watch command:
```bash
uv run aero-debug
```