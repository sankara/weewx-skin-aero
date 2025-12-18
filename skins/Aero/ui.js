// ui.js
import { els, state } from './state.js';
import { THEME, convertItem, getAverage, resolveThemeColor, hexToRgbA } from './utils.js';
import { drawDial } from './charts.js';

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

    // 1. Dials
    // Canvas requires resolved colors (hex/rgb), not CSS variables.
    // We resolve them here before passing to createDialCard.
    const cTemp = resolveThemeColor('--color-temp', '#f59e0b', '#fbbf24');
    const cHum = resolveThemeColor('--color-humidity', '#0ea5e9', '#0ea5e9');
    const cPress = resolveThemeColor('--color-pressure', '#8b5cf6', '#8b5cf6');
    const cUV = resolveThemeColor('--color-uv', '#f43f5e', '#f43f5e');
    const cWind = resolveThemeColor('--color-wind', '#10b981', '#10b981');
    const cRain = resolveThemeColor('--color-rain', '#2563eb', '#2563eb');

    // Also resolve text colors for dial content
    const cTextPrimary = resolveThemeColor('--text-primary', '#1e293b', '#f8fafc');
    const cTextSecondary = resolveThemeColor('--text-secondary', '#64748b', '#94a3b8');

    createDialCard(container, getDialItem('outTemp'), 'Temperature', cTemp, limits.temp.min, limits.temp.max, cTextPrimary, cTextSecondary);
    createDialCard(container, getDialItem('outHumidity'), 'Humidity', cHum, 0, 100, cTextPrimary, cTextSecondary);
    createDialCard(container, getDialItem('barometer') || getDialItem('pressure'), 'Pressure', cPress, limits.pressure.min, limits.pressure.max, cTextPrimary, cTextSecondary);

    // UV is often missing in simulation/test data, handle gracefully
    const uvItem = getDialItem('UV');
    if (uvItem) {
        createDialCard(container, uvItem, 'UV Index', cUV, 0, 15, cTextPrimary, cTextSecondary);
    }

    // 2. Simple Cards (Wind & Rain) - Re-added as per review
    const windItem = getDialItem('windSpeed');
    createSimpleCard(container, windItem, 'wind', cWind);

    // Rain: For "Current" section, usually "Daily Rain" total is most useful,
    // but the `current.json` might only have rainRate.
    // `getDialItem` merges `today.json` so we might have `sum` available if `day` exists.
    const rainItem = getDialItem('rain');
    // If we have a sum from today's log, prefer that for "Total Rain" display
    if (rainItem && rainItem.sum !== undefined) {
        rainItem.current = rainItem.sum;
        rainItem.label = "Rain (Total)";
    }
    createSimpleCard(container, rainItem, 'rain', cRain);
}

function createDialCard(container, item, title, color, absMin, absMax, textPrimary, textSecondary) {
    if (!item || item.current === undefined) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.style.alignItems = 'center';

    div.innerHTML = `
        <div class="card-header" style="width:100%">
            <span class="card-label">${item.label || title}</span>
        </div>
        <canvas width="200" height="150"></canvas>
    `;
    container.appendChild(div);

    const canvas = div.querySelector('canvas');
    // Ensure min/max exist for the dial range visualization
    const dailyMin = item.min !== undefined ? item.min : item.current;
    const dailyMax = item.max !== undefined ? item.max : item.current;

    drawDial(canvas, absMin, absMax, item.current, dailyMin, dailyMax, item.unit, color, title, textPrimary, textSecondary);
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
    div.innerHTML = `
        <div class="card-header">
            <span class="card-label">${label}</span>
            <i data-lucide="${icon}" style="width:18px; height:18px; color:${color}"></i>
        </div>
        <div class="card-value" style="background: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)}); -webkit-background-clip: text;">
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

    // 1. Max Temp
    const temp = convertItem(obs.outTemp, state.units);
    if (temp) {
        if (temp.max !== undefined) createSummaryCard(container, 'High Temp', temp.max, temp.unit, cTemp);
        if (temp.min !== undefined) createSummaryCard(container, 'Low Temp', temp.min, temp.unit, cTemp); // Or cooler color?
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
    div.innerHTML = `
        <div class="card-header">
             <span class="card-label" style="color:${color}">${label}</span>
        </div>
        <div class="card-value" style="background: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)}); -webkit-background-clip: text;">
            ${(+value).toFixed(1)}<span class="card-unit">${unit}</span>
        </div>
    `;
    container.appendChild(div);
}
