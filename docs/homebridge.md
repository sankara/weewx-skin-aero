# Homebridge Integration

The Aero skin provides a template compatible with the [Homebridge WeatherPlus](https://github.com/naofireblade/homebridge-weather-plus) plugin.

## Configuration

1.  **Generate the JSON file**: The Aero skin is pre-configured to generate `data/weatherplus.json`.
2.  **Expose the file**: Ensure your web server serves this file (typically at `http://your-weewx-server/aero/data/weatherplus.json`).
3.  **Homebridge Setup**: In your Homebridge configuration, add a new accessory for WeatherPlus using the `webservice` option.

### Example Homebridge Config

```json
{
    "accessories": [
        {
            "accessory": "WeatherPlus",
            "name": "WeeWX Station",
            "service": "webservice",
            "url": "http://your-weewx-server/aero/data/weatherplus.json",
            "interval": 10
        }
    ]
}
```

## Template Details

The template is located at `skins/Aero/data/weatherplus.json.tmpl`. It includes:
- Temperature (Current, High, Low)
- Humidity
- Pressure
- UV Index
- Wind Speed and Direction
- Rain (Hourly and Daily)
