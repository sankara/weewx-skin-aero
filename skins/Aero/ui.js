// ui.js
import { els, state } from './state.js';
import { THEME, convertItem, getAverage, resolveThemeColor, hexToRgbA } from './utils.js';
import { drawDial, drawCompass } from './charts.js';

/**
 * Renders the Fixed Top Section (Current Conditions)
 */
export function renderHeader() {
    if (!state.currentData) return;

    // 1. Title & Time
    els.title.textContent = "Aero Weather";
    const date = new Date(state.currentData.meta.time * 1000);
    els.lastUpdated.textContent = `Updated: ${date.toLocaleTimeString()}`;

    // 2. Dials (Live Data)
    renderCurrentObservations();
}

/**
 * Renders the Dials and Cards in #current-dials using `state.currentData` (Live)
 * and `state.todayData` (for High/Low context).
 */
function renderCurrentObservations() {
    const container = document.getElementById('current-dials');
    if (!container) return;
    container.innerHTML = '';

    const currentObs = state.currentData.obs;
    const todayObs = state.todayData ? state.todayData.obs : {};

    // Helper: Mix Live Value with Today's Min/Max
    const getDialItem = (key) => {
        const live = currentObs[key];
        const day = todayObs[key];

        if (!live) return null;

        const item = { ...live }; // Start with live
        // Inject min/max from today if available
        if (day) {
            item.min = day.min;
            item.max = day.max;
        }
        return convertItem(item, state.units);
    };

    const limits = {
        temp: state.units === 'imperial' ? { min: 0, max: 120 } : { min: -20, max: 50 },
        pressure: state.units === 'imperial' ? { min: 28, max: 31 } : { min: 950, max: 1050 }
    };

    // 1. Dials & Compass
    // Canvas requires resolved colors (hex/rgb), not CSS variables.
    const cTemp = resolveThemeColor('--color-temp', '#f59e0b', '#fbbf24');
    const cHum = resolveThemeColor('--color-humidity', '#0ea5e9', '#0ea5e9');
    const cPress = resolveThemeColor('--color-pressure', '#8b5cf6', '#8b5cf6');
    const cUV = resolveThemeColor('--color-uv', '#f43f5e', '#f43f5e');
    const cWind = resolveThemeColor('--color-wind', '#10b981', '#10b981');
    const cRain = resolveThemeColor('--color-rain', '#2563eb', '#2563eb');

    const cTextPrimary = resolveThemeColor('--text-primary', '#1e293b', '#f8fafc');
    const cTextSecondary = resolveThemeColor('--text-secondary', '#64748b', '#94a3b8');

    // ORDER: Temp, Humid, Wind, Rain, Pressure, UV

    // 1. Temp
    createDialCard(container, getDialItem('outTemp'), 'Temperature', cTemp, limits.temp.min, limits.temp.max, cTextPrimary, cTextSecondary);

    // 2. Humidity
    createDialCard(container, getDialItem('outHumidity'), 'Humidity', cHum, 0, 100, cTextPrimary, cTextSecondary);

    // 3. Wind (Compass)
    const wSpeed = getDialItem('windSpeed');
    const wGust = getDialItem('windGust');
    const wDir = getDialItem('windDir');
    createCompassCard(container, wSpeed, wGust, wDir, cWind, cTextPrimary, cTextSecondary);

    // 4. Rain (Simple Card)
    const rainItem = getDialItem('rain');
    if (rainItem && rainItem.sum !== undefined) {
        rainItem.current = rainItem.sum;
        rainItem.label = "Rain (Total)";
    }
    createSimpleCard(container, rainItem, 'rain', cRain);

    // 5. Pressure
    const pItem = getDialItem('barometer') || getDialItem('pressure');
    createDialCard(container, pItem, 'Pressure', cPress, limits.pressure.min, limits.pressure.max, cTextPrimary, cTextSecondary);

    // 6. UV
    const uvItem = getDialItem('UV');
    // Ensure we render if 0, but not if null/undefined
    if (uvItem && uvItem.current !== null && uvItem.current !== undefined) {
        createDialCard(container, uvItem, 'UV Index', cUV, 0, 15, cTextPrimary, cTextSecondary);
    }
}

function createDialCard(container, item, title, color, absMin, absMax, textPrimary, textSecondary) {
    if (!item) return;
    // Check for explicit null for differentiation
    const hasData = item.current !== null && item.current !== undefined;
    if (!hasData) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';

    div.innerHTML = `
        <div class="card-header" style="width:100%; justify-content: center;">
            <span class="card-label">${item.label || title}</span>
        </div>
        <canvas width="200" height="150"></canvas>
    `;
    container.appendChild(div);

    const canvas = div.querySelector('canvas');
    const dailyMin = item.min !== undefined && item.min !== null ? item.min : item.current;
    const dailyMax = item.max !== undefined && item.max !== null ? item.max : item.current;

    drawDial(canvas, absMin, absMax, item.current, dailyMin, dailyMax, item.unit, color, title, textPrimary, textSecondary);
}

function createCompassCard(container, speedItem, gustItem, dirItem, color, textPrimary, textSecondary) {
    if (!speedItem) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';

    div.innerHTML = `
        <div class="card-header" style="width:100%; justify-content: center;">
            <span class="card-label">Wind</span>
        </div>
        <canvas width="200" height="150"></canvas>
    `;
    container.appendChild(div);

    const canvas = div.querySelector('canvas');
    // current values
    const speed = speedItem.current;
    const gust = gustItem ? gustItem.current : null;
    const dir = dirItem ? dirItem.current : null;
    const unit = speedItem.unit;

    drawCompass(canvas, speed, gust, dir, unit, color, 'Wind', textPrimary, textSecondary);
}

function createSimpleCard(container, item, type, color) {
    if (!item) return;

    let icon = 'activity';
    if (type === 'wind') { icon = 'wind'; }
    if (type === 'rain') { icon = 'cloud-rain'; }

    // Fallback label
    const label = item.label || (type === 'wind' ? 'Wind Speed' : 'Rain');
    const val = item.current !== undefined ? (+item.current).toFixed(1) : '-';

    const div = document.createElement('div');
    div.className = 'card';
    div.style.alignItems = 'center'; // Center flex items (header and value)
    div.style.justifyContent = 'center';

    div.innerHTML = `
        <div class="card-header" style="width:100%; justify-content: center; gap: 0.5rem;">
            <span class="card-label">${label}</span>
            <i data-lucide="${icon}" style="width:18px; height:18px; color:${color}"></i>
        </div>
        <div class="card-value" style="background: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)}); -webkit-background-clip: text; text-align: center;">
            ${val}<span class="card-unit">${item.unit}</span>
        </div>
    `;
    container.appendChild(div);
}


/**
 * Renders the Middle Section (History Summary)
 * Uses `state.activeData` (History File)
 */
export function renderHistorySummary() {
    const container = document.getElementById('history-summary');
    if (!container) return;
    container.innerHTML = '';

    if (!state.activeData || !state.activeData.obs) return;

    const obs = state.activeData.obs;

    // Resolve Colors properly for the cards
    const cTemp = resolveThemeColor('--color-temp', '#f59e0b', '#fbbf24');
    const cRain = resolveThemeColor('--color-rain', '#2563eb', '#2563eb');
    const cWind = resolveThemeColor('--color-wind', '#10b981', '#10b981');

    // Helper to extract nice summary values
    // We want: Max Temp, Min Temp, Total Rain, Max Wind

    // 1. Temp (Range + Avg as Dial style)
    const temp = convertItem(obs.outTemp, state.units);
    if (temp) {
        // Construct a "Dial Item" from history stats
        // We want: Central = Avg, Range = Min/Max
        // If "avg" is missing (e.g. today.json might not have avg computed yet in standard weewx json?), check avail.
        // Usually day.outTemp.avg is available.
        // Check `daily.json.tmpl`... yes, `avg` is there for wind, but what about temp? 
        // daily.json.tmpl: "graph": $day.outTemp.series...
        // It DOES NOT have "avg" for outTemp explicitly in default structure?
        // Wait, I saw today.json.tmpl content earlier.
        // It has `min` and `max`. It does NOT have `avg`.
        // However, I can compute average from the graph series if needed, OR relies on `getAverage` helper from utils.

        let avgVal = temp.avg;
        if (avgVal === undefined && temp.graph) {
            avgVal = getAverage(temp);
        }

        // Make formatted object for createDialCard
        const tempSummaryItem = {
            current: avgVal !== undefined ? avgVal : (temp.max + temp.min) / 2, // Fallback
            min: temp.min,
            max: temp.max,
            unit: temp.unit,
            label: 'Avg Obs Temp'
        };

        const cTextPrimary = resolveThemeColor('--text-primary', '#1e293b', '#f8fafc');
        const cTextSecondary = resolveThemeColor('--text-secondary', '#64748b', '#94a3b8');

        // Limits need to be defined or inferred?
        // Reuse global limits from renderCurrentObservations or define locally
        // or dynamic limits based on min/max +/- padding?
        // Let's use standard range for the dial background
        const limits = state.units === 'imperial' ? { min: 0, max: 120 } : { min: -20, max: 50 };

        createDialCard(container, tempSummaryItem, 'Avg Temp', cTemp, limits.min, limits.max, cTextPrimary, cTextSecondary);
    }

    // 2. Rain
    const rain = convertItem(obs.rain, state.units);
    if (rain && rain.sum !== undefined) {
        createSummaryCard(container, 'Total Rain', rain.sum, rain.unit, cRain);
    }

    // 3. Wind
    const wind = convertItem(obs.windSpeed, state.units);
    if (wind) {
        if (wind.max !== undefined) createSummaryCard(container, 'Max Gust', wind.max, wind.unit, cWind);
        // Avg wind?
        const avg = getAverage(wind);
        if (avg !== undefined) createSummaryCard(container, 'Avg Wind', avg, wind.unit, cWind);
    }

    if (window.lucide) window.lucide.createIcons();
}

function createSummaryCard(container, label, value, unit, color) {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.alignItems = 'center'; // Center column items
    div.style.justifyContent = 'center';

    div.innerHTML = `
        <div class="card-header" style="justify-content: center;">
             <span class="card-label" style="color:${color}">${label}</span>
        </div>
        <div class="card-value" style="background: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)}); -webkit-background-clip: text; text-align: center;">
            ${(+value).toFixed(1)}<span class="card-unit">${unit}</span>
        </div>
    `;
    container.appendChild(div);
}
