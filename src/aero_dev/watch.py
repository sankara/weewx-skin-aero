import argparse
import http.server
import os
import socketserver
import subprocess
import sys
import threading
import time
from functools import partial


def serve_http(output_dir, port):
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=output_dir)

    # Custom class to ensure SO_REUSEADDR is set
    class ReusingTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        with ReusingTCPServer(("", port), handler) as httpd:
            print(f"\nServing HTTP on http://0.0.0.0:{port}/ ...")
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"\nError: Port {port} is already in use.")
            print("Please stop the other process or use '--port <number>' to specify a different port.")
            # We are in a thread, so we should interrupt the main process or just exit this thread?
            # If server fails, the watch tool is useless. We should exit.
            os._exit(1)  # Force exit
        else:
            raise e


def get_mtimes(path):
    mtimes = {}
    for root, dirs, files in os.walk(path):
        for f in files:
            # Ignore hidden files or emacs temp files
            if f.startswith('.') or f.endswith('~') or f.endswith('.tmp'):
                continue
            full_path = os.path.join(root, f)
            try:
                mtimes[full_path] = os.stat(full_path).st_mtime
            except FileNotFoundError:
                pass
    return mtimes


def main():
    parser = argparse.ArgumentParser(description="Watch and rebuild Aero Skin")
    parser.add_argument("--db", default="test-data/weewx.sdb", help="Path to sqlite database")
    parser.add_argument("--skin", default="skins/Aero", help="Path to skin directory")
    parser.add_argument("--output", default="public_html", help="Output directory")
    parser.add_argument("--port", type=int, default=8000, help="HTTP Port")
    args = parser.parse_args()

    # Normalize paths
    skin_dir = os.path.abspath(args.skin)
    output_dir = os.path.abspath(args.output)

    print(f"Watching {skin_dir}...")
    print(f"Building to {output_dir}...")

    # Initial Build
    print("\n--- Initial Build ---")

    # We use subprocess for build to ensure clean environment (sys.argv issues with direct import)
    build_cmd = ["uv", "run", "aero-build", "--db", args.db, "--skin", args.skin, "--output", args.output]

    try:
        subprocess.run(build_cmd, check=True)
    except subprocess.CalledProcessError:
        print("Initial build failed! Waiting for changes...")

    # Start Server in Thread
    t = threading.Thread(target=serve_http, args=(output_dir, args.port))
    t.daemon = True
    t.start()

    # Watch Loop
    last_mtimes = get_mtimes(skin_dir)

    try:
        while True:
            time.sleep(1)
            current_mtimes = get_mtimes(skin_dir)

            changed = False
            if len(current_mtimes) != len(last_mtimes):
                changed = True
            else:
                for k, v in current_mtimes.items():
                    if k not in last_mtimes or last_mtimes[k] != v:
                        changed = True
                        break

            if changed:
                print("\n--- File Change Detected! Rebuilding... ---")

                # Re-run build
                subprocess.run(build_cmd)

                last_mtimes = current_mtimes
                print("--- Rebuild Complete ---")

    except KeyboardInterrupt:
        print("\nStopping...")
        sys.exit(0)


if __name__ == "__main__":
    main()
