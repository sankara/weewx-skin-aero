# installer for the Aero skin
from weecfg.extension import ExtensionInstaller

def loader():
    return AeroInstaller()

class AeroInstaller(ExtensionInstaller):
    def __init__(self):
        super(AeroInstaller, self).__init__(
            version="2.9.2",
            name='Aero',
            description='A premium modern skin for WeeWX with Canvas-based visualizations.',
            author="Sankara",
            text="Installs the Aero skin.",
            config={
                'StdReport': {
                    'Aero': {
                        'skin': 'Aero',
                        'HTML_ROOT': ''
                    }
                }
            },
            files=[
                ('skins/Aero', [
                    'LICENSE',
                    'README.md',
                    'skins/Aero/VERSION',
                    'skins/Aero/app.js',
                    'skins/Aero/charts.js',
                    'skins/Aero/data/current.json.tmpl',
                    'skins/Aero/data/daily.json.tmpl',
                    'skins/Aero/data/day-YYYY-MM-DD.json.tmpl',
                    'skins/Aero/data/month-YYYY-MM.json.tmpl',
                    'skins/Aero/data/month.json.tmpl',
                    'skins/Aero/data/today.json.tmpl',
                    'skins/Aero/data/trends.json.tmpl',
                    'skins/Aero/data/week-to-date.json.tmpl',
                    'skins/Aero/data/week.json.tmpl',
                    'skins/Aero/data/forecast.json.tmpl',
                    'skins/Aero/data/weatherplus.json.tmpl',
                    'skins/Aero/index.html',
                    'skins/Aero/skin.conf',
                    'skins/Aero/state.js',
                    'skins/Aero/style.css',
                    'skins/Aero/ui.js',
                    'skins/Aero/utils.js',
                ]),
                ('bin/user', [
                    'bin/user/aero_forecast.py',
                ]),
            ]
        )
