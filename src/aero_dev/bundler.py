import os
import subprocess
import shutil
import re
import logging
from typing import List

# Configure logging
logger = logging.getLogger(__name__)

def update_html_references(html: str, js_bundle: str, css_bundle: str) -> str:
    """Updates CSS and JS references in HTML content."""
    # Replace CSS link
    # Pattern: <link rel="stylesheet" href="style.css">
    html = re.sub(r'<link rel="stylesheet" href=["\']?style\.css["\']?>', 
                  f'<link rel="stylesheet" href="dist/{css_bundle}">', html)

    # Replace JS script
    # Pattern: <script type="module" src="app.js"></script>
    html = re.sub(r'<script (type="module" )?src=["\']?app\.js["\']?></script>', 
                  f'<script src="dist/{js_bundle}"></script>', html)
    
    return html

def update_skin_conf(conf: str, js_bundle: str, css_bundle: str) -> str:
    """Updates copy_once list in skin.conf."""
    removals = ['style.css', 'app.js', 'utils.js', 'charts.js', 'ui.js', 'state.js']
    additions = [f"dist/{js_bundle}", f"dist/{css_bundle}"]

    def replacer(match):
        line = match.group(1) # content after =
        items = [x.strip() for x in line.split(',')]
        
        # Filter out removals
        new_items = [x for x in items if x not in removals]
        
        # Add additions
        for item in additions:
            if item not in new_items:
                new_items.append(item)
        
        return "copy_once = " + ", ".join(new_items)

    return re.sub(r'copy_once\s*=\s*(.*)', replacer, conf)

def run_bundler(skin_dir: str) -> None:
    """
    Runs Webpack build in the skin directory and updates references.
    """
    skin_dir = os.path.abspath(skin_dir)
    logger.info("Bundling assets in %s...", skin_dir)

    # 1. Check for node_modules, install if missing
    if not os.path.exists(os.path.join(skin_dir, 'node_modules')):
        logger.info("Installing npm dependencies...")
        subprocess.check_call(['npm', 'install'], cwd=skin_dir)

    # 2. Run Webpack Build
    logger.info("Running Webpack build...")
    subprocess.check_call(['npm', 'run', 'build'], cwd=skin_dir)

    # 3. Identify generated bundles
    dist_dir = os.path.join(skin_dir, 'dist')
    if not os.path.exists(dist_dir):
        raise RuntimeError("Webpack build failed: dist directory not found")

    js_bundle = None
    css_bundle = None

    for f in os.listdir(dist_dir):
        if f.endswith('.js') and 'bundle' in f:
            js_bundle = f
        if f.endswith('.css') and 'bundle' in f:
            css_bundle = f
    
    if not js_bundle or not css_bundle:
        raise RuntimeError(f"Could not find bundles in {dist_dir}. Found: {os.listdir(dist_dir)}")

    logger.info("Generated bundles: %s, %s", js_bundle, css_bundle)

    # 4. Update index.html or index.html.tmpl
    index_name = 'index.html'
    if not os.path.exists(os.path.join(skin_dir, index_name)):
        index_name = 'index.html.tmpl'
    
    index_path = os.path.join(skin_dir, index_name)
    if not os.path.exists(index_path):
        raise FileNotFoundError(f"Could not find index.html or index.html.tmpl in {skin_dir}")

    with open(index_path, 'r') as f:
        html = f.read()

    html = update_html_references(html, js_bundle, css_bundle)

    with open(index_path, 'w') as f:
        f.write(html)
    
    logger.info("Updated %s references.", index_name)

    # 5. Update skin.conf
    conf_path = os.path.join(skin_dir, 'skin.conf')
    if not os.path.exists(conf_path):
        logger.warning("skin.conf not found at %s", conf_path)
        return

    with open(conf_path, 'r') as f:
        conf = f.read()

    conf = update_skin_conf(conf, js_bundle, css_bundle)

    with open(conf_path, 'w') as f:
        f.write(conf)

    logger.info("Updated skin.conf copy_once list.")
