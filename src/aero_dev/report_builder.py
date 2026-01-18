import argparse
import logging
import os
import shutil
import sys
import time

import configobj
import weewx.cheetahgenerator
import weewx.manager
import weewx.schemas.wview_extended as schemas
from weewx.reportengine import StdReportEngine
from weewx.station import StationInfo

import aero_dev.bundler as bundler

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def get_mock_config(repo_root: str, db_path: str, skin_root: str, output_dir: str) -> configobj.ConfigObj:
    """Returns a mock WeeWX configuration dictionary."""
    config_dict = {
        'WEEWX_ROOT': repo_root,
        'Station': {
            'location': 'Test Station',
            'latitude': 45.0,
            'longitude': -120.0,
            'altitude': [100, 'foot'],
            'station_type': 'Simulator',
            'station_url': 'https://example.com',
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
    return configobj.ConfigObj(config_dict)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Aero Skin Report")
    parser.add_argument("--db", default="weewx.sdb", help="Path to sqlite database")
    parser.add_argument("--skin", default="skins/Aero", help="Path to Aero skin directory (relative to repo root)")
    parser.add_argument("--output", default="public_html", help="Output directory")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    if args.debug:
        logger.setLevel(logging.DEBUG)
        # Monkeypatch CheetahGenerator to debug
        original_run = weewx.cheetahgenerator.CheetahGenerator.run

        def debug_run(self):
            logger.debug("CheetahGenerator run invoked")
            return original_run(self)

        weewx.cheetahgenerator.CheetahGenerator.run = debug_run

    repo_root = os.getcwd()
    db_path = os.path.abspath(args.db)
    output_dir = os.path.abspath(args.output)

    # Resolve skin path
    if os.path.isabs(args.skin):
        src_skin = args.skin
    else:
        src_skin = os.path.abspath(os.path.join(repo_root, args.skin))

    # For a local dev build with bundling, we must work on a copy to avoid checking in modified index.html
    build_root = os.path.join(repo_root, "build", "dev_skin")
    if os.path.exists(build_root):
        shutil.rmtree(build_root)
    os.makedirs(build_root)

    skin_name = os.path.basename(src_skin)  # Aero
    skin_dir = os.path.join(build_root, skin_name)  # build/dev_skin/Aero

    logger.info("Creating temporary build skin at %s", skin_dir)
    # Check if node_modules exists in the source to avoid redundant installs
    src_node_modules = os.path.join(src_skin, 'node_modules')

    # Custom ignore function that excludes dotfiles at root level but preserves .bin in node_modules
    def ignore_dotfiles_except_bin(directory, files):
        # Check if we're inside node_modules - if so, don't ignore anything
        if 'node_modules' in directory:
            return []
        # At root level, ignore dotfiles/dotdirs (but not .bin since we're not in node_modules)
        return [f for f in files if f.startswith('.')]

    if os.path.exists(src_node_modules):
        logger.info("Found existing node_modules in source. Copying...")
        shutil.copytree(src_skin, skin_dir, ignore=ignore_dotfiles_except_bin, symlinks=True)
    else:
        shutil.copytree(src_skin, skin_dir, ignore=shutil.ignore_patterns('node_modules', '.*'))

    # Run Bundler on the copy
    try:
        bundler.run_bundler(skin_dir)
    except Exception as e:
        logger.error("Bundling failed: %s", e)
        sys.exit(1)

    # Clean output dir
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir)

    config = get_mock_config(repo_root, db_path, build_root, output_dir)

    try:
        logger.info("Initializing Database and Day Summaries...")
        manager_dict = weewx.manager.get_manager_dict_from_config(config, 'wx_binding')

        if manager_dict.get('schema') is None:
            manager_dict['schema'] = schemas.schema

        last_ts = None
        with weewx.manager.open_manager(manager_dict, initialize=True) as db_manager:
            db_manager.backfill_day_summary()
            last_ts = db_manager.lastGoodStamp()

        if last_ts is None:
            logger.error("Database is empty!")
            sys.exit(1)

        logger.info("Using generation timestamp: %d (%s)", last_ts,
                    time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(last_ts)))

        stn_info = StationInfo(None, **config['Station'])

        record = None
        with weewx.manager.open_manager(manager_dict) as db_manager:
            record = db_manager.getRecord(last_ts)

        # Add skin's bin directory to the Python path for Search List Extensions
        skin_bin_dir = os.path.join(skin_dir, 'bin')
        if os.path.exists(skin_bin_dir) and skin_bin_dir not in sys.path:
            sys.path.insert(0, skin_bin_dir)
            logger.debug("Added %s to Python path for Search List Extensions", skin_bin_dir)

        logger.info("Starting Report Engine...")
        engine = StdReportEngine(config, stn_info, record=record, gen_ts=last_ts, first_run=True)
        engine.run()

        logger.info("Report generation finished.")

    except Exception as e:
        logger.exception("Error building report: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
