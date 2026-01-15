"""
Aero Skin Forecast Extension for WeeWX

This Search List Extension (SLE) provides weather forecast data to Cheetah templates.
It first checks if WeeWX has forecast data (e.g., from weewx-forecast extension),
then falls back to Open-Meteo API if not available.

Search List Extensions in WeeWX are Python classes that extend the data available
to Cheetah templates by adding custom variables to the template's search list.
"""

import json
import logging
import sqlite3
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

try:
    from urllib.request import urlopen, Request
    from urllib.error import URLError, HTTPError
except ImportError:
    from urllib2 import urlopen, Request, URLError, HTTPError

from weewx.cheetahgenerator import SearchList
from weeutil.weeutil import to_bool

log = logging.getLogger(__name__)

VERSION = "1.0.0"


class AeroForecast(SearchList):
    """
    Search List Extension that provides forecast data to templates.

    This class is instantiated by WeeWX's CheetahGenerator and makes forecast
    data available to templates via $aero_forecast variable.
    """

    def __init__(self, generator):
        SearchList.__init__(self, generator)

        # Get configuration from skin.conf [Extras] section
        extras = self.generator.skin_dict.get('Extras', {})

        self.enable_forecast = to_bool(extras.get('enable_forecast', True))
        self.forecast_latitude = extras.get('forecast_latitude')
        self.forecast_longitude = extras.get('forecast_longitude')
        self.openmeteo_api_key = extras.get('openmeteo_api_key')

        # Cache settings
        self.cache_duration = 3600  # 1 hour in seconds
        self.cache_db_path = extras.get('forecast_cache_db', '/var/tmp/aero_forecast_cache.db')

        # Instance cache - persists for this report run only
        # Prevents repeated processing for each template
        self._forecast_result = None

        # Initialize cache database
        self._init_cache_db()

        log.info(f"AeroForecast SLE initialized (v{VERSION})")

    def _init_cache_db(self):
        """Initialize SQLite database for caching forecast responses."""
        try:
            conn = sqlite3.connect(self.cache_db_path)
            cursor = conn.cursor()

            # Create cache table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS forecast_cache (
                    id INTEGER PRIMARY KEY,
                    timestamp INTEGER NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    provider TEXT NOT NULL,
                    data TEXT NOT NULL
                )
            ''')

            # Create index for faster lookups
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_location_provider
                ON forecast_cache(latitude, longitude, provider)
            ''')

            conn.commit()
            conn.close()
            log.debug(f"Forecast cache database initialized at {self.cache_db_path}")
        except Exception as e:
            log.error(f"Failed to initialize forecast cache database: {e}")

    def _get_cached_forecast(self, lat: float, lon: float, provider: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached forecast data if still valid.

        Args:
            lat: Latitude
            lon: Longitude
            provider: Data provider name ('weewx' or 'openmeteo')

        Returns:
            Cached forecast data or None if expired/not found
        """
        try:
            conn = sqlite3.connect(self.cache_db_path)
            cursor = conn.cursor()

            cutoff_time = int(time.time()) - self.cache_duration

            cursor.execute('''
                SELECT data, timestamp FROM forecast_cache
                WHERE latitude = ? AND longitude = ? AND provider = ?
                AND timestamp > ?
                ORDER BY timestamp DESC LIMIT 1
            ''', (lat, lon, provider, cutoff_time))

            row = cursor.fetchone()
            conn.close()

            if row:
                data, timestamp = row
                age_minutes = (time.time() - timestamp) / 60
                log.info(f"Using cached {provider} forecast (age: {age_minutes:.1f} minutes)")
                return json.loads(data)

            return None
        except Exception as e:
            log.error(f"Error reading forecast cache: {e}")
            return None

    def _save_to_cache(self, lat: float, lon: float, provider: str, data: Dict[str, Any]):
        """
        Save forecast data to cache.

        Args:
            lat: Latitude
            lon: Longitude
            provider: Data provider name
            data: Forecast data to cache
        """
        try:
            conn = sqlite3.connect(self.cache_db_path)
            cursor = conn.cursor()

            # Clean old entries (older than 24 hours)
            old_cutoff = int(time.time()) - (24 * 3600)
            cursor.execute('DELETE FROM forecast_cache WHERE timestamp < ?', (old_cutoff,))

            # Insert new cache entry
            cursor.execute('''
                INSERT INTO forecast_cache (timestamp, latitude, longitude, provider, data)
                VALUES (?, ?, ?, ?, ?)
            ''', (int(time.time()), lat, lon, provider, json.dumps(data)))

            conn.commit()
            conn.close()
            log.debug(f"Saved {provider} forecast to cache")
        except Exception as e:
            log.error(f"Error saving forecast to cache: {e}")

    def _check_weewx_forecast(self) -> Optional[Dict[str, Any]]:
        """
        Check if WeeWX has forecast data (e.g., from weewx-forecast extension).

        Returns:
            Forecast data from WeeWX or None if not available
        """
        try:
            # Check if forecast table exists in WeeWX database
            # This is a simplified check - actual implementation depends on
            # the weewx-forecast extension schema

            # Try to access forecast data through the generator's database binding
            db_manager = self.generator.db_binder.get_manager()

            # Check if forecast table exists
            conn = db_manager.connection
            cursor = conn.cursor()

            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='forecast'
            """)

            if not cursor.fetchone():
                log.debug("No forecast table found in WeeWX database")
                return None

            # If table exists, try to fetch recent forecast data
            cursor.execute("""
                SELECT * FROM forecast
                WHERE dateTime > ?
                ORDER BY dateTime DESC LIMIT 1
            """, (int(time.time()) - self.cache_duration,))

            row = cursor.fetchone()

            if row:
                log.info("Found forecast data in WeeWX database")
                # Parse WeeWX forecast data
                # This would need to be adapted based on actual weewx-forecast schema
                return self._parse_weewx_forecast(row)

            log.debug("No recent forecast data in WeeWX database")
            return None

        except Exception as e:
            log.debug(f"Could not read WeeWX forecast data: {e}")
            return None

    def _parse_weewx_forecast(self, row) -> Dict[str, Any]:
        """
        Parse forecast data from WeeWX database.
        This is a placeholder - actual implementation depends on weewx-forecast schema.
        """
        # TODO: Implement based on actual weewx-forecast extension schema
        log.warning("WeeWX forecast parsing not fully implemented yet")
        return None

    def _fetch_openmeteo_forecast(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """
        Fetch forecast data from Open-Meteo API.

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            Forecast data or None if request fails
        """
        try:
            # Check cache first
            cached = self._get_cached_forecast(lat, lon, 'openmeteo')
            if cached:
                return cached

            # Build API URL
            base_url = "https://api.open-meteo.com/v1/forecast"

            # Include comprehensive weather variables
            params = {
                'latitude': lat,
                'longitude': lon,
                'hourly': 'temperature_2m,relative_humidity_2m,precipitation_probability,'
                         'precipitation,weather_code,wind_speed_10m,wind_direction_10m',
                'daily': 'weather_code,temperature_2m_max,temperature_2m_min,'
                        'precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
                'temperature_unit': 'fahrenheit',
                'wind_speed_unit': 'mph',
                'precipitation_unit': 'inch',
                'timezone': 'auto',
                'forecast_days': 7
            }

            # Add API key if provided
            if self.openmeteo_api_key:
                params['apikey'] = self.openmeteo_api_key

            # Build query string
            query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
            url = f"{base_url}?{query_string}"

            log.info(f"Fetching Open-Meteo forecast for lat={lat}, lon={lon}")

            # Make request
            request = Request(url)
            request.add_header('User-Agent', f'WeeWX-Aero-Skin/{VERSION}')

            response = urlopen(request, timeout=10)
            data = json.loads(response.read().decode('utf-8'))

            # Parse and structure the data
            forecast_data = self._parse_openmeteo_response(data)

            # Save to cache
            self._save_to_cache(lat, lon, 'openmeteo', forecast_data)

            log.info("Successfully fetched Open-Meteo forecast")
            return forecast_data

        except (URLError, HTTPError) as e:
            log.error(f"Failed to fetch Open-Meteo forecast: {e}")
            return None
        except Exception as e:
            log.error(f"Error processing Open-Meteo forecast: {e}")
            return None

    def _fetch_openmeteo_alerts(self, lat: float, lon: float) -> List[Dict[str, Any]]:
        """
        Fetch weather alerts from Open-Meteo (if available in their API).
        Note: As of 2026, Open-Meteo may not have a dedicated alerts endpoint.
        This is a placeholder for future implementation or alternative sources.
        """
        # TODO: Implement alerts fetching
        # Could use NWS API for US locations, MeteoAlarm for Europe, etc.
        try:
            # For US locations, we could use NWS API
            if -125 <= lon <= -66 and 24 <= lat <= 50:
                return self._fetch_nws_alerts(lat, lon)
        except Exception as e:
            log.debug(f"Could not fetch alerts: {e}")

        return []

    def _fetch_nws_alerts(self, lat: float, lon: float) -> List[Dict[str, Any]]:
        """
        Fetch weather alerts from NOAA National Weather Service API (US only).

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            List of active weather alerts
        """
        try:
            url = f"https://api.weather.gov/alerts/active?point={lat},{lon}"

            request = Request(url)
            request.add_header('User-Agent', f'WeeWX-Aero-Skin/{VERSION}')

            response = urlopen(request, timeout=10)
            data = json.loads(response.read().decode('utf-8'))

            alerts = []
            for feature in data.get('features', []):
                props = feature.get('properties', {})
                alerts.append({
                    'event': props.get('event', 'Unknown'),
                    'headline': props.get('headline', ''),
                    'description': props.get('description', ''),
                    'severity': props.get('severity', 'Unknown'),
                    'urgency': props.get('urgency', 'Unknown'),
                    'onset': props.get('onset', ''),
                    'expires': props.get('expires', ''),
                    'instruction': props.get('instruction', '')
                })

            if alerts:
                log.info(f"Found {len(alerts)} weather alert(s)")

            return alerts

        except Exception as e:
            log.debug(f"Could not fetch NWS alerts: {e}")
            return []

    def _parse_openmeteo_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Open-Meteo API response into our forecast format.

        Args:
            data: Raw API response

        Returns:
            Structured forecast data
        """
        hourly = data.get('hourly', {})
        daily = data.get('daily', {})

        # Parse hourly forecast (next 48 hours)
        hourly_forecast = []
        if hourly and hourly.get('time'):
            times = hourly['time']
            temps = hourly.get('temperature_2m', [])
            humidity = hourly.get('relative_humidity_2m', [])
            precip_prob = hourly.get('precipitation_probability', [])
            precip = hourly.get('precipitation', [])
            weather_codes = hourly.get('weather_code', [])
            wind_speed = hourly.get('wind_speed_10m', [])
            wind_dir = hourly.get('wind_direction_10m', [])

            # Limit to 48 hours
            for i in range(min(48, len(times))):
                hourly_forecast.append({
                    'timestamp': times[i],
                    'temp': temps[i] if i < len(temps) else None,
                    'humidity': humidity[i] if i < len(humidity) else None,
                    'precipProb': precip_prob[i] if i < len(precip_prob) else None,
                    'precip': precip[i] if i < len(precip) else None,
                    'weatherCode': weather_codes[i] if i < len(weather_codes) else None,
                    'icon': self._weather_code_to_icon(weather_codes[i] if i < len(weather_codes) else None),
                    'windSpeed': wind_speed[i] if i < len(wind_speed) else None,
                    'windDir': wind_dir[i] if i < len(wind_dir) else None
                })

        # Parse daily forecast (7 days)
        daily_forecast = []
        if daily and daily.get('time'):
            times = daily['time']
            temp_max = daily.get('temperature_2m_max', [])
            temp_min = daily.get('temperature_2m_min', [])
            precip_sum = daily.get('precipitation_sum', [])
            precip_prob = daily.get('precipitation_probability_max', [])
            weather_codes = daily.get('weather_code', [])
            wind_speed = daily.get('wind_speed_10m_max', [])

            for i in range(min(7, len(times))):
                daily_forecast.append({
                    'date': times[i],
                    'tempHigh': temp_max[i] if i < len(temp_max) else None,
                    'tempLow': temp_min[i] if i < len(temp_min) else None,
                    'precip': precip_sum[i] if i < len(precip_sum) else None,
                    'precipProb': precip_prob[i] if i < len(precip_prob) else None,
                    'weatherCode': weather_codes[i] if i < len(weather_codes) else None,
                    'icon': self._weather_code_to_icon(weather_codes[i] if i < len(weather_codes) else None),
                    'windSpeed': wind_speed[i] if i < len(wind_speed) else None
                })

        return {
            'hourly': hourly_forecast,
            'daily': daily_forecast,
            'provider': 'openmeteo',
            'updated': int(time.time())
        }

    def _weather_code_to_icon(self, code: Optional[int]) -> str:
        """
        Convert WMO weather code to icon name.

        WMO Weather interpretation codes (WW):
        0: Clear sky
        1, 2, 3: Mainly clear, partly cloudy, and overcast
        45, 48: Fog
        51, 53, 55: Drizzle
        61, 63, 65: Rain
        71, 73, 75: Snow
        77: Snow grains
        80, 81, 82: Rain showers
        85, 86: Snow showers
        95: Thunderstorm
        96, 99: Thunderstorm with hail
        """
        if code is None:
            return 'help-circle'

        code_map = {
            0: 'sun',
            1: 'sun',
            2: 'cloud-sun',
            3: 'cloud',
            45: 'cloud-fog',
            48: 'cloud-fog',
            51: 'cloud-drizzle',
            53: 'cloud-drizzle',
            55: 'cloud-drizzle',
            61: 'cloud-rain',
            63: 'cloud-rain',
            65: 'cloud-rain',
            71: 'snowflake',
            73: 'snowflake',
            75: 'snowflake',
            77: 'snowflake',
            80: 'cloud-rain',
            81: 'cloud-rain',
            82: 'cloud-rain',
            85: 'snowflake',
            86: 'snowflake',
            95: 'cloud-lightning',
            96: 'cloud-lightning',
            99: 'cloud-lightning'
        }

        return code_map.get(code, 'cloud')

    def get_extension_list(self, timespan, db_lookup):
        """
        Required method for SearchList extensions.
        Returns a list of dictionaries to add to the search list.

        This method is called by WeeWX's CheetahGenerator for every template.
        We use instance-level caching to avoid repeated processing.
        """
        # Return cached result if already fetched this report run
        if self._forecast_result is not None:
            return self._forecast_result

        if not self.enable_forecast:
            log.debug("Forecast feature is disabled in configuration")
            self._forecast_result = [{'aero_forecast': None}]
            return self._forecast_result

        # Get latitude and longitude
        lat = self.forecast_latitude
        lon = self.forecast_longitude

        # Fall back to station location if not explicitly configured
        if lat is None or lon is None:
            try:
                lat = float(self.generator.config_dict['Station'].get('latitude', 0))
                lon = float(self.generator.config_dict['Station'].get('longitude', 0))
                log.info(f"Using station location for forecast: lat={lat}, lon={lon}")
            except (KeyError, ValueError) as e:
                log.error(f"Could not determine location for forecast: {e}")
                self._forecast_result = [{'aero_forecast': None}]
                return self._forecast_result

        # Validate coordinates
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            log.error(f"Invalid coordinates: lat={lat}, lon={lon}")
            self._forecast_result = [{'aero_forecast': None}]
            return self._forecast_result

        # Try to get forecast from WeeWX first
        forecast_data = self._check_weewx_forecast()

        # Fall back to Open-Meteo if WeeWX doesn't have forecast data
        if forecast_data is None:
            forecast_data = self._fetch_openmeteo_forecast(lat, lon)

        # Fetch weather alerts
        alerts = []
        if forecast_data:
            alerts = self._fetch_openmeteo_alerts(lat, lon)
            forecast_data['alerts'] = alerts

        # Cache and return the forecast data
        self._forecast_result = [{'aero_forecast': forecast_data}]
        return self._forecast_result


def get_extension_list(config_dict, skin_dict):
    """
    Required function for WeeWX to load this Search List Extension.

    This function is called by WeeWX when loading the skin. It should return
    a SearchList subclass (not an instance).
    """
    return [AeroForecast]
