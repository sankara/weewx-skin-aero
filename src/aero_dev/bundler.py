import os
import subprocess
import shutil
import re

def run_bundler(skin_dir):
    """
    Runs Webpack build in the skin directory and updates references.
    """
    skin_dir = os.path.abspath(skin_dir)
    print(f"Bundling assets in {skin_dir}...")

    # 1. Check for node_modules, install if missing
    if not os.path.exists(os.path.join(skin_dir, 'node_modules')):
        print("Installing npm dependencies...")
        subprocess.check_call(['npm', 'install'], cwd=skin_dir)

    # 2. Run Webpack Build
    print("Running Webpack build...")
    subprocess.check_call(['npm', 'run', 'build'], cwd=skin_dir)

    # 3. Identify generated bundles
    dist_dir = os.path.join(skin_dir, 'dist')
    if not os.path.exists(dist_dir):
        raise Exception("Webpack build failed: dist directory not found")

    js_bundle = None
    css_bundle = None

    for f in os.listdir(dist_dir):
        if f.endswith('.js') and 'bundle' in f:
            js_bundle = f
        if f.endswith('.css') and 'bundle' in f:
            css_bundle = f
    
    if not js_bundle or not css_bundle:
        raise Exception(f"Could not find bundles in {dist_dir}. Found: {os.listdir(dist_dir)}")

    print(f"Generated bundles: {js_bundle}, {css_bundle}")

    # 4. Update index.html or index.html.tmpl
    index_name = 'index.html'
    if not os.path.exists(os.path.join(skin_dir, index_name)):
        index_name = 'index.html.tmpl'
    
    index_path = os.path.join(skin_dir, index_name)
    if not os.path.exists(index_path):
        raise Exception(f"Could not find index.html or index.html.tmpl in {skin_dir}")

    with open(index_path, 'r') as f:
        html = f.read()

    # Replace CSS link
    # Pattern: <link rel="stylesheet" href="style.css">
    html = re.sub(r'<link rel="stylesheet" href="style\.css">', 
                  f'<link rel="stylesheet" href="dist/{css_bundle}">', html)

    # Replace JS script
    # Pattern: <script type="module" src="app.js"></script>
    html = re.sub(r'<script type="module" src="app\.js"></script>', 
                  f'<script src="dist/{js_bundle}"></script>', html)

    with open(index_path, 'w') as f:
        f.write(html)
    
    print(f"Updated {index_name} references.")

    # 5. Update skin.conf
    # We need to ensure the CopyGenerator copies the 'dist' folder or the specific files.
    # Actually, usually we list individual files in copy_once.
    # Let's update copy_once to include the new files and remove the old ones.
    
    conf_path = os.path.join(skin_dir, 'skin.conf')
    with open(conf_path, 'r') as f:
        conf = f.read()

    # Files to remove from copy_once
    removals = ['style.css', 'app.js', 'utils.js', 'charts.js', 'ui.js', 'state.js']
    
    # Files to add
    additions = [f"dist/{js_bundle}", f"dist/{css_bundle}"]

    # Regex to find copy_once line
    # copy_once = index.html, style.css, app.js, ...
    
    def replacer(match):
        line = match.group(1) # content after =
        items = [x.strip() for x in line.split(',')]
        
        # Filter out removals
        new_items = [x for x in items if x not in removals]
        
        # Add additions
        new_items.extend(additions)
        
        return "copy_once = " + ", ".join(new_items)

    conf = re.sub(r'copy_once\s*=\s*(.*)', replacer, conf)

    with open(conf_path, 'w') as f:
        f.write(conf)

    print("Updated skin.conf copy_once list.")
