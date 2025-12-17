import argparse
import time
import random
import sys
import sqlite3
from datetime import datetime, timedelta
import weewx.units
import weewx.manager
import math

# Standard WeeWX schema (wview_extended)
SCHEMA = [
    ('dateTime', 'INTEGER NOT NULL UNIQUE PRIMARY KEY'),
    ('usUnits', 'INTEGER NOT NULL'),
    ('interval', 'INTEGER NOT NULL'),
    ('altimeter', 'REAL'),
    ('appTemp', 'REAL'),
    ('barometer', 'REAL'),
    ('batteryStatus1', 'REAL'),
    ('batteryStatus2', 'REAL'),
    ('batteryStatus3', 'REAL'),
    ('batteryStatus4', 'REAL'),
    ('batteryStatus5', 'REAL'),
    ('batteryStatus6', 'REAL'),
    ('batteryStatus7', 'REAL'),
    ('batteryStatus8', 'REAL'),
    ('cloudbase', 'REAL'),
    ('co', 'REAL'),
    ('co2', 'REAL'),
    ('consBatteryVoltage', 'REAL'),
    ('dewpoint', 'REAL'),
    ('ET', 'REAL'),
    ('extraHumid1', 'REAL'),
    ('extraHumid2', 'REAL'),
    ('extraHumid3', 'REAL'),
    ('extraHumid4', 'REAL'),
    ('extraHumid5', 'REAL'),
    ('extraHumid6', 'REAL'),
    ('extraHumid7', 'REAL'),
    ('extraHumid8', 'REAL'),
    ('extraTemp1', 'REAL'),
    ('extraTemp2', 'REAL'),
    ('extraTemp3', 'REAL'),
    ('extraTemp4', 'REAL'),
    ('extraTemp5', 'REAL'),
    ('extraTemp6', 'REAL'),
    ('extraTemp7', 'REAL'),
    ('extraTemp8', 'REAL'),
    ('forecast', 'REAL'),
    ('hail', 'REAL'),
    ('hailRate', 'REAL'),
    ('heatindex', 'REAL'),
    ('heatingVoltage', 'REAL'),
    ('humidex', 'REAL'),
    ('inDewpoint', 'REAL'),
    ('inHumidity', 'REAL'),
    ('inTemp', 'REAL'),
    ('inTempBatteryStatus', 'REAL'),
    ('leafTemp1', 'REAL'),
    ('leafTemp2', 'REAL'),
    ('leafWet1', 'REAL'),
    ('leafWet2', 'REAL'),
    ('lightning_distance', 'REAL'),
    ('lightning_strike_count', 'REAL'),
    ('luminosity', 'REAL'),
    ('maxSolarRad', 'REAL'),
    ('nh3', 'REAL'),
    ('no2', 'REAL'),
    ('noise', 'REAL'),
    ('o3', 'REAL'),
    ('outHumidity', 'REAL'),
    ('outTemp', 'REAL'),
    ('outTempBatteryStatus', 'REAL'),
    ('pb', 'REAL'),
    ('pm10_0', 'REAL'),
    ('pm1_0', 'REAL'),
    ('pm2_5', 'REAL'),
    ('pressure', 'REAL'),
    ('radiation', 'REAL'),
    ('rain', 'REAL'),
    ('rainBatteryStatus', 'REAL'),
    ('rainRate', 'REAL'),
    ('referenceVoltage', 'REAL'),
    ('rxCheckPercent', 'REAL'),
    ('signal1', 'REAL'),
    ('signal2', 'REAL'),
    ('signal3', 'REAL'),
    ('signal4', 'REAL'),
    ('signal5', 'REAL'),
    ('signal6', 'REAL'),
    ('signal7', 'REAL'),
    ('signal8', 'REAL'),
    ('snow', 'REAL'),
    ('snowDepth', 'REAL'),
    ('snowMoisture', 'REAL'),
    ('snowRate', 'REAL'),
    ('so2', 'REAL'),
    ('soilMoist1', 'REAL'),
    ('soilMoist2', 'REAL'),
    ('soilMoist3', 'REAL'),
    ('soilMoist4', 'REAL'),
    ('soilTemp1', 'REAL'),
    ('soilTemp2', 'REAL'),
    ('soilTemp3', 'REAL'),
    ('soilTemp4', 'REAL'),
    ('supplyVoltage', 'REAL'),
    ('txBatteryStatus', 'REAL'),
    ('UV', 'REAL'),
    ('windBatteryStatus', 'REAL'),
    ('windDir', 'REAL'),
    ('windGust', 'REAL'),
    ('windGustDir', 'REAL'),
    ('windrun', 'REAL'),
    ('windSpeed', 'REAL'),
]

def create_table(cursor):
    cols = ", ".join([f"{name} {dtype}" for name, dtype in SCHEMA])
    cursor.execute(f"CREATE TABLE IF NOT EXISTS archive ({cols})")

def generate_record(timestamp):
    # Determine season/time of day for somewhat realistic values
    dt = datetime.fromtimestamp(timestamp)

    # Base temp based on time of day (coolest at 4am, warmest at 3pm)
    hour = dt.hour
    day_progress = (hour + dt.minute / 60) / 24.0

    # Simple sine wave for daily temperature cycle
    temp_swing = 15.0 # degrees F swing
    avg_temp = 65.0

    # Peak at 15:00
    temp_offset = math.sin(2 * math.pi * (day_progress - 9.0/24.0)) * (temp_swing / 2.0)
    outTemp = avg_temp + temp_offset

    # Random noise
    outTemp += random.uniform(-1.0, 1.0)

    # Humidity inverse to temp usually
    outHumidity = 50.0 - (temp_offset * 1.5) + random.uniform(-5, 5)
    outHumidity = max(10, min(100, outHumidity))

    # Dewpoint approx: T - ((100 - RH)/5.0)
    dewpoint = outTemp - ((100.0 - outHumidity) / 5.0)

    # Wind
    windSpeed = random.uniform(0, 10)
    if random.random() > 0.9: windSpeed += 10 # Gusts

    windGust = windSpeed * random.uniform(1.0, 1.5)
    windDir = random.uniform(0, 360)

    # Rain (rarely)
    rain = 0.0
    if random.random() > 0.95:
        rain = random.uniform(0.01, 0.05)

    return {
        'dateTime': timestamp,
        'usUnits': weewx.US,
        'interval': 5,
        'outTemp': outTemp,
        'outHumidity': outHumidity,
        'dewpoint': dewpoint,
        'barometer': 29.92 + random.uniform(-0.1, 0.1),
        'windSpeed': windSpeed,
        'windGust': windGust,
        'windDir': windDir,
        'rain': rain,
        'rainRate': rain * 12.0, # hourly rate approx
        'UV': max(0, math.sin(2 * math.pi * (day_progress - 0.5)) * 10) if 6 <= hour <= 18 else 0,
        'radiation': max(0, math.sin(2 * math.pi * (day_progress - 0.5)) * 1000) if 6 <= hour <= 18 else 0,
    }

def main():
    parser = argparse.ArgumentParser(description="Generate WeeWX test data")
    parser.add_argument("--output", default="weewx.sdb", help="Output database file")
    parser.add_argument("--days", type=int, default=7, help="Number of days to generate")
    args = parser.parse_args()

    conn = sqlite3.connect(args.output)
    cursor = conn.cursor()

    create_table(cursor)

    end_time = int(time.time())
    start_time = end_time - (args.days * 86400)

    # Snap to 5 minute boundary
    start_time = start_time - (start_time % 300)

    print(f"Generating data from {datetime.fromtimestamp(start_time)} to {datetime.fromtimestamp(end_time)}")

    current = start_time
    count = 0
    batch = []

    while current <= end_time:
        rec = generate_record(current)

        # Build sql
        keys = rec.keys()
        vals = [rec[k] for k in keys]
        placeholders = ",".join(["?" for _ in keys])
        cols = ",".join(keys)

        batch.append(vals)

        if len(batch) >= 1000:
            cursor.executemany(f"INSERT OR REPLACE INTO archive ({cols}) VALUES ({placeholders})", batch)
            batch = []
            print(f"Generated {count} records...", end='\r')

        current += 300 # 5 minutes
        count += 1

    if batch:
        cursor.executemany(f"INSERT OR REPLACE INTO archive ({cols}) VALUES ({placeholders})", batch)

    conn.commit()
    conn.close()
    print(f"\nDone. Generated {count} records in {args.output}")

if __name__ == "__main__":
    main()
