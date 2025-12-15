// ui.js
import { els, state } from './state.js';
import { THEME, convertItem, getAverage } from './utils.js';
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
    renderCurrentDials();
}

/**
 * Renders the Dials in #current-dials using `state.currentData` (Live)
 * and `state.todayData` (for High/Low context).
 */
function renderCurrentDials() {
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

    createDialCard(container, getDialItem('outTemp'), 'Temperature', THEME.outTemp, limits.temp.min, limits.temp.max);
    createDialCard(container, getDialItem('outHumidity'), 'Humidity', THEME.humidity, 0, 100);
    createDialCard(container, getDialItem('barometer') || getDialItem('pressure'), 'Pressure', THEME.pressure, limits.pressure.min, limits.pressure.max);

    // UV is often missing in simulation/test data, handle gracefully
    const uvItem = getDialItem('UV');
    if (uvItem) {
        createDialCard(container, uvItem, 'UV Index', THEME.uv, 0, 15);
    }
}

function createDialCard(container, item, title, color, absMin, absMax) {
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

    drawDial(canvas, absMin, absMax, item.current, dailyMin, dailyMax, item.unit, color, title);
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

    // Helper to extract nice summary values
    // We want: Max Temp, Min Temp, Total Rain, Max Wind

    // 1. Max Temp
    const temp = convertItem(obs.outTemp, state.units);
    if (temp) {
        if (temp.max !== undefined) createSummaryCard(container, 'High Temp', temp.max, temp.unit, THEME.outTemp);
        if (temp.min !== undefined) createSummaryCard(container, 'Low Temp', temp.min, temp.unit, THEME.outTemp); // Or cooler color?
    }

    // 2. Rain
    const rain = convertItem(obs.rain, state.units);
    if (rain && rain.sum !== undefined) {
        createSummaryCard(container, 'Total Rain', rain.sum, rain.unit, THEME.rainRate);
    }

    // 3. Wind
    const wind = convertItem(obs.windSpeed, state.units);
    if (wind) {
        if (wind.max !== undefined) createSummaryCard(container, 'Max Gust', wind.max, wind.unit, THEME.windSpeed);
        // Avg wind?
        const avg = getAverage(wind);
        if (avg !== undefined) createSummaryCard(container, 'Avg Wind', avg, wind.unit, THEME.windSpeed);
    }

    if (window.lucide) window.lucide.createIcons();
}

function createSummaryCard(container, label, value, unit, color) {
    const div = document.createElement('div');
    div.className = 'summary-card';
    div.innerHTML = `
        <div class="label" style="color:${color}">${label}</div>
        <div class="value">${(+value).toFixed(1)} <span class="unit">${unit}</span></div>
    `;
    container.appendChild(div);
}
