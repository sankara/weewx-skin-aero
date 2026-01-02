---
description: How to develop and debug the Aero skin interactively
---

The recommended way to debug and develop the Aero skin is using the `aero-dev` watcher. This tool creates a build environment, starts a local server, and watches for file changes to automatically rebuild.

1. Ensure dependencies are installed (first run only):
   ```bash
   uv sync
   ```

2. Start the development server:
   ```bash
   uv run aero-dev
   ```
   
   This command will:
   - Use the test database at `test-data/weewx.sdb` by default
   - Build the skin to `public_html`
   - Start a local web server at `http://localhost:8000`
   - Watch for changes in `skins/Aero` and `src` and auto-rebuild

3. Open your browser:
   http://localhost:8000

4. (Optional) Manual Build:
   If you only want to generate the files one time without starting a server:
   ```bash
   uv run aero-build --db test-data/weewx.sdb --output public_html
   ```