# installer for the Aero skin
from weecfg.extension import ExtensionInstaller

def loader():
    return AeroInstaller()

class AeroInstaller(ExtensionInstaller):
    def __init__(self):
        super(AeroInstaller, self).__init__(
            version="2.1.2",
            name='aero',
            description='A premium modern skin for WeeWX with Canvas-based visualizations.',
            author="Sankara",
            text="Installs the Aero skin.",
            config={
                'StdReport': {
                    'aero': {
                        'skin': 'aero',
                        'HTML_ROOT': 'aero'
                    }
                }
            },
            files=[
                ('skins/Aero', [
                    'skins/Aero/skin.conf',
                    'skins/Aero/index.html',
                    'skins/Aero/style.css',
                    'skins/Aero/app.js',
                    'skins/Aero/charts.js',
                    'skins/Aero/ui.js',
                    'skins/Aero/state.js',
                    'skins/Aero/utils.js',
                    'README.md',
                    'LICENSE',
                    'skins/Aero/VERSION',
                    'skins/Aero/templates/current.json.tmpl',
                    'skins/Aero/templates/daily.json.tmpl',
                    'skins/Aero/templates/week.json.tmpl',
                    'skins/Aero/templates/month.json.tmpl',
                    'skins/Aero/templates/trends.json.tmpl'
                ]),
            ]
        )
