import pytest
from aero_dev.bundler import update_html_references, update_skin_conf

def test_update_html_references():
    html = """
    <html>
    <head>
        <link rel="stylesheet" href="style.css">
    </head>
    <body>
        <script type="module" src="app.js"></script>
    </body>
    </html>
    """
    js_bundle = "main.bundle.js"
    css_bundle = "style.bundle.css"
    
    updated = update_html_references(html, js_bundle, css_bundle)
    
    assert f'href="dist/{css_bundle}"' in updated
    assert f'src="dist/{js_bundle}"' in updated
    assert 'type="module"' not in updated

def test_update_skin_conf():
    conf = "copy_once = index.html, style.css, app.js, utils.js, data/favicon.ico"
    js_bundle = "main.bundle.js"
    css_bundle = "style.bundle.css"
    
    updated = update_skin_conf(conf, js_bundle, css_bundle)
    
    assert "style.css" not in updated
    assert "app.js" not in updated
    assert f"dist/{js_bundle}" in updated
    assert f"dist/{css_bundle}" in updated
    assert "data/favicon.ico" in updated
    assert "index.html" in updated
