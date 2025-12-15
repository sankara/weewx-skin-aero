# installer for the Aero skin
from weecfg.extension import ExtensionInstaller

def loader():
    return AeroInstaller()

class AeroInstaller(ExtensionInstaller):
    def __init__(self):
        super(AeroInstaller, self).__init__(
            version="2.0.0",
            name='aero',
            description='A premium modern skin for WeeWX with Canvas-based visualizations.',
            author="Sankara",
            text="Installs the Aero skin.",
            config={
                'StdReport': {
                    'Aero': {
                        'skin': 'Aero',
                        'HTML_ROOT': 'aero'
                    }
                }
            },
            files=[
                ('skins/Aero', [
                    'skin.conf',
                    'index.html',
                    'style.css',
                    'app.js',
                    'README.md',
                    'LICENSE',
                    'VERSION'
                ]),
                ('skins/Aero/templates', [
                    'templates/*.tmpl'
                ]),
            ]
        )
