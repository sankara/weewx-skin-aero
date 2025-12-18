# WeeWX SDB Schema

## Archive Table
```sql
CREATE TABLE archive (dateTime INTEGER NOT NULL UNIQUE PRIMARY KEY, usUnits INTEGER NOT NULL, interval INTEGER NOT NULL, barometer REAL, pressure REAL, altimeter REAL, inTemp REAL, outTemp REAL, inHumidity REAL, outHumidity REAL, windSpeed REAL, windDir REAL, windGust REAL, windGustDir REAL, rainRate REAL, rain REAL, dewpoint REAL, windchill REAL, heatindex REAL, ET REAL, radiation REAL, UV REAL, extraTemp1 REAL, extraTemp2 REAL, extraTemp3 REAL, soilTemp1 REAL, soilTemp2 REAL, soilTemp3 REAL, soilTemp4 REAL, leafTemp1 REAL, leafTemp2 REAL, extraHumid1 REAL, extraHumid2 REAL, extraHumid3 REAL, extraHumid4 REAL, extraHumid5 REAL, extraHumid6 REAL, extraHumid7 REAL, extraHumid8 REAL, soilMoist1 REAL, soilMoist2 REAL, soilMoist3 REAL, soilMoist4 REAL, leafWet1 REAL, leafWet2 REAL, rxCheckPercent REAL, txBatteryStatus REAL, consBatteryVoltage REAL, hail REAL, hailRate REAL, heatingTemp REAL, heatingVoltage REAL, supplyVoltage REAL, referenceVoltage REAL, windBatteryStatus REAL, rainBatteryStatus REAL, outTempBatteryStatus REAL, inTempBatteryStatus REAL);
```

## Daily Summary Tables
(Truncated list of tables - basically `archive_day_<field>`)
- archive_day_ET
- archive_day_UV
- archive_day_altimeter
- archive_day_barometer
- archive_day_consBatteryVoltage
- archive_day_dewpoint
- archive_day_extraHumid1-8
- archive_day_extraTemp1-3
- archive_day_hail
- archive_day_hailRate
- archive_day_heatindex
- archive_day_heatingTemp
- archive_day_heatingVoltage
- archive_day_inHumidity
- archive_day_inTemp
- archive_day_inTempBatteryStatus
- archive_day_leafTemp1-2
- archive_day_leafWet1-2
- archive_day_outHumidity
- archive_day_outTemp
- archive_day_outTempBatteryStatus
- archive_day_pm10_0
- archive_day_pm1_0
- archive_day_pm2_5
- archive_day_pressure
- archive_day_radiation
- archive_day_rain
- archive_day_rainBatteryStatus
- archive_day_rainRate
- archive_day_referenceVoltage
- archive_day_rxCheckPercent
- archive_day_signal1-8
- archive_day_snow*
- archive_day_so2
- archive_day_soilMoist1-4
- archive_day_soilTemp1-4
- archive_day_supplyVoltage
- archive_day_txBatteryStatus
- archive_day_uvBatteryStatus
- archive_day_wind* (wind, windDir, windGust, windGustDir, windSpeed, windBatteryStatus, windrun, windchill)

### Daily Summary Schema
Common structure for `archive_day_<field>` tables:
```sql
CREATE TABLE archive_day_FIELD (
    dateTime INTEGER NOT NULL UNIQUE PRIMARY KEY, 
    min REAL, mintime INTEGER, 
    max REAL, maxtime INTEGER, 
    sum REAL, count INTEGER, 
    wsum REAL, sumtime INTEGER
);
```
