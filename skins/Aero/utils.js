// utils.js

/**
 * Standard colors tied to CSS variables.
 */
export const THEME = {
    outTemp: 'var(--color-temp)',
    humidity: 'var(--color-humidity)',
    windSpeed: 'var(--color-wind)',
    pressure: 'var(--color-pressure)',
    rainRate: 'var(--color-rain)',
    uv: 'var(--color-uv)',
    gray: 'var(--text-secondary)'
};

/**
 * Resolves a CSS variable to a Hex color string.
 * Falls back to hardcoded defaults if CSS variable resolution fails (e.g., initial load or missing style).
 *
 * @param {string} varName - CSS Variable name (e.g. '--color-temp')
 * @param {string} lightHex - Fallback for Light Mode
 * @param {string} darkHex - Fallback for Dark Mode
 * @returns {string} - The resolved Hex color
 */
export function resolveThemeColor(varName, lightHex, darkHex) {
    const style = getComputedStyle(document.documentElement);
    const val = style.getPropertyValue(varName).trim();
    if (val && val !== '') return val;

    // Fallback logic
    const isDark = document.documentElement.classList.contains('dark');
    return isDark ? darkHex : lightHex;
}

const CONVERSIONS = {
    '°F': { target: '°C', func: v => (v - 32) * 5 / 9, type: 'temp' },
    'F': { target: '°C', func: v => (v - 32) * 5 / 9, type: 'temp' },
    '°C': { target: '°F', func: v => (v * 9 / 5) + 32, type: 'temp' },
    'C': { target: '°F', func: v => (v * 9 / 5) + 32, type: 'temp' },

    'mph': { target: 'km/h', func: v => v * 1.60934, type: 'speed' },
    'km/h': { target: 'mph', func: v => v / 1.60934, type: 'speed' },
    'm/s': { target: 'mph', func: v => v * 2.23694, type: 'speed' },
    'kts': { target: 'mph', func: v => v * 1.15078, type: 'speed' },

    'inHg': { target: 'hPa', func: v => v * 33.8639, type: 'pressure' },
    'hPa': { target: 'inHg', func: v => v / 33.8639, type: 'pressure' },
    'mbar': { target: 'inHg', func: v => v / 33.8639, type: 'pressure' },

    'in': { target: 'mm', func: v => v * 25.4, type: 'rain' },
    'mm': { target: 'in', func: v => v / 25.4, type: 'rain' },
    'cm': [
        { target: 'in', func: v => v / 2.54, type: 'rain' },
        { target: 'mm', func: v => v * 10, type: 'rain' }
    ],
    'in/h': { target: 'mm/h', func: v => v * 25.4, type: 'rainRate' },
    'in/hr': { target: 'mm/h', func: v => v * 25.4, type: 'rainRate' },
    'mm/h': { target: 'in/h', func: v => v / 25.4, type: 'rainRate' },
    'mm/hr': { target: 'in/h', func: v => v / 25.4, type: 'rainRate' },
    'cm/h': [
        { target: 'in/h', func: v => v / 2.54, type: 'rainRate' },
        { target: 'mm/h', func: v => v * 10, type: 'rainRate' }
    ],
    'cm/hr': [
        { target: 'in/h', func: v => v / 2.54, type: 'rainRate' },
        { target: 'mm/h', func: v => v * 10, type: 'rainRate' }
    ]
};

const TARGET_UNITS = {
    metric: {
        temp: '°C',
        speed: 'km/h',
        pressure: 'hPa',
        rain: 'mm',
        rainRate: 'mm/h'
    },
    imperial: {
        temp: '°F',
        speed: 'mph',
        pressure: 'inHg',
        rain: 'in',
        rainRate: 'in/h'
    }
};

/**
 * Converts a WeeWX data item (e.g., observation or summary) to the target unit system.
 * 
 * @param {Object} item - The data item with .unit and values like .current, .min, .max.
 * @param {'metric'|'imperial'} unitSystem - The target unit system.
 * @returns {Object} - A new item with converted units and values.
 */
export function convertItem(item, unitSystem) {
    if (!item || !item.unit) return item;

    // Clean unit (remove spaces)
    const unit = item.unit.trim();

    // Identify type
    let type = null;
    if (['°C', '°F', 'C', 'F'].includes(unit)) type = 'temp';
    if (['km/h', 'mph', 'm/s', 'kts'].includes(unit)) type = 'speed';
    if (['hPa', 'mbar', 'inHg'].includes(unit)) type = 'pressure';
    if (['mm', 'in', 'cm'].includes(unit)) type = 'rain';
    if (['mm/h', 'mm/hr', 'in/h', 'in/hr', 'cm/h', 'cm/hr'].includes(unit)) type = 'rainRate';

    if (!type) return item;

    const targetUnit = TARGET_UNITS[unitSystem][type];
    if (unit === targetUnit) return item;

    let conv = CONVERSIONS[unit];
    if (Array.isArray(conv)) {
        conv = conv.find(c => c.target === targetUnit);
    }

    if (!conv || conv.target !== targetUnit) {
        return item;
    }

    const convert = conv.func;
    const newItem = { ...item };
    newItem.unit = targetUnit;

    const keysToConvert = ['current', 'min', 'max', 'avg', 'sum'];
    keysToConvert.forEach(k => {
        if (newItem[k] !== undefined && newItem[k] !== null) {
            newItem[k] = convert(newItem[k]);
        }
    });

    if (newItem.graph && Array.isArray(newItem.graph)) {
        newItem.graph = newItem.graph.map(p => {
            if (!Array.isArray(p)) return p;

            if (p.length >= 3) {
                // [start, end, val]
                return [p[0], p[1], (p[2] !== null && p[2] !== undefined) ? convert(p[2]) : p[2]];
            }
            if (p.length >= 2) {
                // [time, val]
                return [p[0], (p[1] !== null && p[1] !== undefined) ? convert(p[1]) : p[1]];
            }
            return p;
        });
    }

    return newItem;
}

/**
 * Checks if two Date objects represent the same calendar day.
 */
export function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

/**
 * Calculates or retrieves the average value for a data item.
 */
export function getAverage(item) {
    if (item.avg !== undefined && item.avg !== null) return item.avg;
    if (item.sum !== undefined && item.sum !== null && item.count) {
        return item.sum / item.count;
    }

    if (item.graph && Array.isArray(item.graph) && item.graph.length > 0) {
        let validCount = 0;
        const sum = item.graph.reduce((acc, p) => {
            const val = (Array.isArray(p) && p.length >= 2) ? (p.length >= 3 ? p[2] : p[1]) : null;
            if (val !== null && val !== undefined) {
                validCount++;
                return acc + val;
            }
            return acc;
        }, 0);
        return validCount > 0 ? sum / validCount : undefined;
    }

    if (item.min !== undefined && item.min !== null && item.max !== undefined && item.max !== null) {
        return (item.min + item.max) / 2;
    }
    return item.current;
}

/**
 * Converts a hex color string to rgba format.
 */
export function hexToRgbA(hex, alpha) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
}

/**
 * Converts degrees to a compass direction (e.g., 0 -> N).
 */
export function degToCompass(num) {
    if (num === null || num === undefined) return "--";
    const val = Math.floor((num / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
}

/**
 * Samples data by a given time interval to reduce density.
 */
export function sampleData(data, minutes) {
    if (!data || data.length === 0) return [];
    const ms = minutes * 60 * 1000;
    const result = [];
    let lastTs = -Infinity;

    // Sort just in case
    data.sort((a, b) => a.x - b.x);

    data.forEach(p => {
        if (p.x - lastTs >= ms) {
            result.push(p);
            lastTs = p.x;
        }
    });
    return result;
}

/**
 * Aggregates high-res data for longer time periods (Month/Year).
 * @param {Array} graphData - [[ts, val], ...]
 * @param {'month'|'year'|'week'} scope - The view scope.
 * @returns {Array} - [{x: ts, min, max, avg, sum}, ...]
 */
export function aggregate(graphData, scope) {
    if (!graphData || !graphData.length) return [];

    const grouped = new Map();

    graphData.forEach((p) => {
        if (!Array.isArray(p)) return;
        const ts = p[0];
        const val = (p.length >= 3) ? p[2] : p[1];
        if (val === null || val === undefined) return;

        const date = new Date(ts * 1000);
        let key; // Bucket key (timestamp of start of bucket)

        if (scope === 'year') {
            // Group by Month
            date.setDate(1);
            date.setHours(0, 0, 0, 0);
            key = date.getTime();
        } else {
            // Group by Day (for Month/Week view)
            date.setHours(0, 0, 0, 0);
            key = date.getTime();
        }

        if (!grouped.has(key)) {
            grouped.set(key, { values: [] });
        }
        grouped.get(key).values.push(val);
    });

    // Process groups
    const result = [];
    const sortedKeys = Array.from(grouped.keys()).sort((a, b) => a - b);

    sortedKeys.forEach(key => {
        const values = grouped.get(key).values;
        let sum = 0;
        let min = Infinity;
        let max = -Infinity;

        values.forEach(v => {
            sum += v;
            if (v < min) min = v;
            if (v > max) max = v;
        });

        const avg = sum / values.length;

        result.push({
            x: key,
            min: min,
            max: max,
            avg: avg,
            sum: sum,
            count: values.length
        });
    });

    return result;
}
