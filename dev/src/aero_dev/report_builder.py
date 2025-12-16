import argparse
import os
import sys
import shutil
import tempfile
import time
import logging
import configobj
import weewx.manager
from weewx.station import StationInfo
from weewx.reportengine import StdReportEngine
import schemas.wview_extended
import weedb
import weewx.cheetahgenerator

def main():
    # Setup logging
    logging.basicConfig(level=logging.DEBUG, stream=sys.stdout, format='%(levelname)s: %(message)s')

    # Monkeypatch CheetahGenerator to debug
    original_run = weewx.cheetahgenerator.CheetahGenerator.run
    def debug_run(self):
        print("DEBUG: CheetahGenerator run invoked")
        return original_run(self)

    weewx.cheetahgenerator.CheetahGenerator.run = debug_run

    parser = argparse.ArgumentParser(description="Build Aero Skin Report")
    parser.add_argument("--db", default="weewx.sdb", help="Path to sqlite database")
    parser.add_argument("--skin", default="../skins/Aero", help="Path to Aero skin directory (relative to repo root)")
    parser.add_argument("--output", default="public_html", help="Output directory")
    args = parser.parse_args()

    # Resolve paths
    repo_root = os.getcwd()
    if os.path.basename(repo_root) == "dev":
        repo_root = os.path.dirname(repo_root)

    db_path = os.path.abspath(args.db)
    skin_dir = os.path.abspath(os.path.join(repo_root, "skins/Aero"))
    skin_root = os.path.dirname(skin_dir)
    output_dir = os.path.abspath(args.output)

    # Clean output dir
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir)

    # Mock weewx.conf
    config_dict = {
        'WEEWX_ROOT': repo_root,
        'Station': {
            'location': 'Test Station',
            'latitude': 45.0,
            'longitude': -120.0,
            'altitude': [100, 'foot'],
            'station_type': 'Simulator',
            'station_url': 'http://example.com',
            'week_start': 6,
        },
        'Simulator': {
            'driver': 'weewx.drivers.simulator',
        },
        'StdReport': {
            'SKIN_ROOT': skin_root,
            'HTML_ROOT': output_dir,
            'data_binding': 'wx_binding',
            'Aero': {
                'skin': 'Aero',
                'HTML_ROOT': output_dir,
                'enable': True,
            }
        },
        'DataBindings': {
            'wx_binding': {
                'manager': 'weewx.manager.DaySummaryManager',
                'schema': 'schemas.wview_extended.schema',
                'table_name': 'archive',
                'database': 'archive_sqlite',
            }
        },
        'Databases': {
            'archive_sqlite': {
                'database_name': db_path,
                'database_type': 'SQLite',
            }
        },
        'DatabaseTypes': {
            'SQLite': {
                'driver': 'weedb.sqlite',
                'SQLITE_ROOT': os.path.dirname(db_path),
            }
        },
        'StdConvert': {
             'target_unit': 'US',
        }
    }

    config = configobj.ConfigObj(config_dict)

    try:
        print("Initializing Database and Day Summaries...")
        manager_dict = weewx.manager.get_manager_dict_from_config(config, 'wx_binding')

        if manager_dict.get('schema') is None:
            manager_dict['schema'] = schemas.wview_extended.schema

        last_ts = None

        with weewx.manager.open_manager(manager_dict, initialize=True) as db_manager:
            db_manager.backfill_day_summary()
            last_ts = db_manager.lastGoodStamp()

        if last_ts is None:
            print("Error: Database is empty!")
            sys.exit(1)

        print(f"Using generation timestamp: {last_ts} ({time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(last_ts))})")

        stn_info = StationInfo(None, **config['Station'])

        record = None
        with weewx.manager.open_manager(manager_dict) as db_manager:
            record = db_manager.getRecord(last_ts)

        print("Starting Report Engine...")
        engine = StdReportEngine(config, stn_info, record=record, gen_ts=last_ts, first_run=True)
        engine.run()

        # REMOVED MOVE WORKAROUND

        print("Report generation finished.")

    except Exception as e:
        print(f"Error building report: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
