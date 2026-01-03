// ui.js
import { els, state } from './state.js';
import { THEME, convertItem, getAverage, resolveThemeColor, hexToRgbA } from './utils.js';
import { drawDial, drawCompass, drawGauge } from './charts.js';

/**
 * Renders the Fixed Top Section (Current Conditions)
 */
export function renderHeader() {
    if (!state.currentData) return;

    // 1. Title & Time
    const stationName = state.currentData.title || "Aero Weather";
    els.title.innerHTML = `<a href="#/day" class="home-link">${stationName}</a>`;
    document.title = stationName;
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

    const tempUnit = state.units.temp;
    const pressUnit = state.units.pressure;

    const limits = {
        temp: (tempUnit === '°F' || tempUnit === 'F') ? { min: 0, max: 120 } : { min: -20, max: 50 },
        pressure: (pressUnit === 'inHg') ? { min: 28, max: 31 } : { min: 950, max: 1050 }
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

    // Resolve Compass Theme Colors
    const cTickC = resolveThemeColor('--color-compass-tick-cardinal', '#94a3b8', '#94a3b8');
    const cTickM = resolveThemeColor('--color-compass-tick-major', '#cbd5e1', '#cbd5e1');
    const cTickm = resolveThemeColor('--color-compass-tick-minor', '#e2e8f0', '#e2e8f0');
    const cArrow = resolveThemeColor('--color-compass-arrow', '#64748b', '#64748b');

    const compassTheme = {
        tickCardinal: cTickC,
        tickMajor: cTickM,
        tickMinor: cTickm,
        arrow: cArrow
    };

    createCompassCard(container, wSpeed, wGust, wDir, cWind, cTextPrimary, cTextSecondary, compassTheme);

    // 4. Rain (Combined Card)
    const rainItem = getDialItem('rain');
    const rainRateItem = getDialItem('rainRate');
    const rainHourItem = getDialItem('rainHour');

    if (rainItem && rainItem.sum !== undefined) {
        rainItem.current = rainItem.sum;
        rainItem.label = "Total Rain";
    }

    // Create Rain Card with Total, Hour and Rate
    createRainCard(container, rainItem, rainHourItem, rainRateItem, cRain);

    // 5. Pressure (New Gauge)
    const pItem = getDialItem('barometer') || getDialItem('pressure');
    createGaugeCard(container, pItem, 'Pressure', cPress, limits.pressure.min, limits.pressure.max, cTextPrimary, cTextSecondary);

    // 6. UV
    const uvItem = getDialItem('UV');
    // Ensure we render if 0, but not if null/undefined
    if (uvItem && uvItem.current !== null && uvItem.current !== undefined) {
        createDialCard(container, uvItem, 'UV Index', cUV, 0, 15, cTextPrimary, cTextSecondary);
    }

    if (window.lucide) window.lucide.createIcons();
}

function createGaugeCard(container, item, title, color, absMin, absMax, textPrimary, textSecondary) {
    if (!item || item.current === null || item.current === undefined) return;

    const div = document.createElement('div');
    div.className = 'card';

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">${title}</span>
            <i data-lucide="gauge" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <canvas width="280" height="260" class="dial-canvas"></canvas>
    `;
    container.appendChild(div);

    const canvas = div.querySelector('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${title}: ${item.current} ${item.unit}`);
    drawGauge(canvas, absMin, absMax, item.current, item.unit, color, null, textPrimary, textSecondary);
}

function createDialCard(container, item, title, color, absMin, absMax, textPrimary, textSecondary) {
    if (!item || item.current === null || item.current === undefined) return;

    const div = document.createElement('div');
    div.className = 'card';

    let icon = 'thermometer';
    if (title.toLowerCase().includes('humidity')) icon = 'droplets';
    if (title.toLowerCase().includes('uv')) icon = 'sun';

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">${item.label || title}</span>
            <i data-lucide="${icon}" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <canvas width="280" height="260" class="dial-canvas"></canvas>
    `;
    container.appendChild(div);

    const canvas = div.querySelector('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${item.label || title}: ${item.current} ${item.unit}`);
    const dailyMin = item.min !== undefined && item.min !== null ? item.min : item.current;
    const dailyMax = item.max !== undefined && item.max !== null ? item.max : item.current;

    drawDial(canvas, absMin, absMax, item.current, dailyMin, dailyMax, item.unit, color, title, textPrimary, textSecondary);
}

function createCompassCard(container, speedItem, gustItem, dirItem, color, textPrimary, textSecondary, theme) {
    if (!speedItem || speedItem.current === null) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.className = 'card';
    // div.style.minHeight = '320px'; // Removed to fix aspect ratio

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">Wind</span>
            <i data-lucide="wind" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <canvas width="280" height="260" class="dial-canvas"></canvas>
    `;
    container.appendChild(div);

    const canvas = div.querySelector('canvas');
    // current values
    const speed = speedItem.current;
    const gust = gustItem ? gustItem.current : null;
    const dir = dirItem ? dirItem.current : null;
    const unit = speedItem.unit;

    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Wind: ${speed} ${unit}${dir !== null ? ', Direction: ' + dir + '°' : ''}`);

    // Pass null for title
    drawCompass(canvas, speed, gust, dir, unit, color, null, textPrimary, textSecondary, theme);
}

function createCombinedCard(container, item1, item2, type, color) {
    if (!item1) return;

    let icon = 'activity';
    if (type === 'wind') { icon = 'wind'; }
    if (type === 'rain') { icon = 'cloud-rain'; }

    // Labels
    const label1 = item1.label || (type === 'wind' ? 'Wind Speed' : 'Rain');
    const label2 = item2 ? (item2.label || (type === 'wind' ? 'Gust' : 'Rate')) : '';

    const precision1 = type === 'rain' ? 2 : 1;
    const precision2 = type === 'rain' ? 2 : 1;

    const val1 = item1.current !== undefined ? (+item1.current).toFixed(precision1) : '-';
    const val2 = (item2 && item2.current !== undefined) ? (+item2.current).toFixed(precision2) : '-';

    const div = document.createElement('div');
    div.className = 'card';
    div.className = 'card';
    // div.style.minHeight = '320px'; // Removed to fix aspect ratio

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">${label1}</span>
            <i data-lucide="${icon}" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <div class="rain-content">
            <div class="card-value value-display-lg" style="background-image: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)});">
                ${val1}
            </div>
            <div class="card-unit unit-display-md">${item1.unit}</div>
            
            ${item2 ? `
            <div style="margin-top: 1rem; display: flex; flex-direction: column; align-items: center;">
                <span class="card-label-sm" style="color: var(--text-secondary); font-size: 0.85rem;">${label2}</span>
                <div style="font-size: 1.2rem; font-weight: 600; color: ${color};">
                    ${val2} <span style="font-size: 0.8rem; color: var(--text-secondary);">${item2.unit}</span>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    container.appendChild(div);
}

function createRainCard(container, totalItem, hourItem, rateItem, color) {
    if (!totalItem) return;

    const icon = 'cloud-rain';
    const valTotal = totalItem.current !== undefined ? (+totalItem.current).toFixed(2) : '-';
    const valHour = hourItem ? (hourItem.current !== undefined ? (+hourItem.current).toFixed(2) : '-') : null;
    const valRate = rateItem ? (rateItem.current !== undefined ? (+rateItem.current).toFixed(2) : '-') : null;

    const div = document.createElement('div');
    div.className = 'card';
    div.className = 'card';
    // div.style.minHeight = '320px'; // Removed to fix aspect ratio

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">${totalItem.label || 'Total Rain'}</span>
            <i data-lucide="${icon}" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <div class="rain-content">
            <div class="card-value value-display-lg" style="background-image: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)});">
                ${valTotal}
            </div>
            <div class="card-unit unit-display-md">${totalItem.unit}</div>
            
            <div class="rain-stats-grid">
                ${valHour !== null ? `
                <div class="rain-stat-item">
                    <span class="card-label-xs">Last Hour</span>
                    <div class="rain-stat-value">
                        ${valHour} <span class="rain-stat-unit">${totalItem.unit}</span>
                    </div>
                </div>
                ` : ''}
                ${valRate !== null ? `
                <div class="rain-stat-item">
                    <span class="card-label-xs">Rate</span>
                    <div class="rain-stat-value">
                        ${valRate} <span class="rain-stat-unit">${rateItem.unit}</span>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    container.appendChild(div);
}

function createSimpleCard(container, item, type, color) {
    if (!item) return;

    let icon = 'activity';
    if (type === 'wind') { icon = 'wind'; }
    if (type === 'rain') { icon = 'cloud-rain'; }

    // Fallback label
    const label = item.label || (type === 'wind' ? 'Wind Speed' : 'Rain');
    const precision = type === 'rain' ? 2 : 1;
    const val = item.current !== undefined ? (+item.current).toFixed(precision) : '-';

    const div = document.createElement('div');
    div.className = 'card';
    div.className = 'card';
    // div.style.minHeight = '320px'; // Removed to fix aspect ratio
    // Removed justifyContent center to fix alignment with other cards

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">${label}</span>
            <i data-lucide="${icon}" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <div class="rain-content">
            <div class="card-value value-display-lg" style="background-image: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)});">
                ${val}
            </div>
            <div class="card-unit unit-display-md">${item.unit}</div>
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
    container.innerHTML = ''; // Clear only the card container

    if (!state.activeData || !state.activeData.obs) return;

    // Dynamic Title Logic
    let titleText = 'Summary';
    const view = state.viewScope;
    if (view === 'day') titleText = 'Daily Summary';
    else if (view === 'week') titleText = 'Weekly Summary';
    else if (view === 'month') titleText = 'Monthly Summary';
    else if (view === 'year') titleText = 'Yearly Summary';

    const titleEl = document.getElementById('history-title'); // Assuming history-title is outside the cleared container
    if (titleEl) {
        titleEl.textContent = titleText;
    }

    // Grid Container for Summary Cards
    const summaryGrid = document.createElement('div');
    summaryGrid.className = 'summary-grid';
    container.appendChild(summaryGrid);

    const obs = state.activeData.obs;

    // Resolve Colors properly for the cards
    const cTemp = resolveThemeColor('--color-temp', '#f59e0b', '#fbbf24');
    const cRain = resolveThemeColor('--color-rain', '#2563eb', '#2563eb');
    const cWind = resolveThemeColor('--color-wind', '#10b981', '#10b981');
    const cHum = resolveThemeColor('--color-humidity', '#0ea5e9', '#0ea5e9');
    const cPress = resolveThemeColor('--color-pressure', '#8b5cf6', '#8b5cf6');
    const cTextPrimary = resolveThemeColor('--text-primary', '#1e293b', '#f8fafc');
    const cTextSecondary = resolveThemeColor('--text-secondary', '#64748b', '#94a3b8');

    // 1. Temp (Range + Avg as Dial style)
    const temp = convertItem(obs.outTemp, state.units);
    if (temp) {
        let avgVal = temp.avg;
        if (avgVal === undefined && temp.graph) {
            avgVal = getAverage(temp);
        }

        const tempSummaryItem = {
            current: avgVal !== undefined ? avgVal : (temp.max + temp.min) / 2,
            min: temp.min,
            max: temp.max,
            unit: temp.unit,
            unit: temp.unit,
            label: 'TEMPERATURE'
        };

        const limits = (state.units.temp === '°F' || state.units.temp === 'F') ? { min: 0, max: 120 } : { min: -20, max: 50 };
        createDialCard(summaryGrid, tempSummaryItem, 'Temperature', cTemp, limits.min, limits.max, cTextPrimary, cTextSecondary);
    }

    // 2. Rain (Combined Total + Max Rate)
    const rain = convertItem(obs.rain, state.units);
    const rainRate = convertItem(obs.rainRate, state.units);

    if (rain && rain.sum !== undefined) {
        const item1 = { current: rain.sum, unit: rain.unit, label: 'TOTAL RAIN' };
        let item2 = null;

        if (rainRate && rainRate.max !== undefined) {
            item2 = { current: rainRate.max, unit: rainRate.unit, label: 'MAX RATE' };
        }

        createCombinedCard(summaryGrid, item1, item2, 'rain', cRain);
    }

    // 3. Wind (Combined Max Gust + Avg)
    const wind = convertItem(obs.windSpeed, state.units);
    const gust = convertItem(obs.windGust, state.units);

    if (wind) {
        let maxGustVal = wind.max;
        if (gust && gust.max !== undefined) {
            maxGustVal = gust.max;
        }

        const item1 = { current: maxGustVal, unit: wind.unit, label: 'MAX GUST' };
        let item2 = null;

        const avg = getAverage(wind);
        if (avg !== undefined) {
            item2 = { current: avg, unit: wind.unit, label: 'AVG WIND' };
        }

        createCombinedCard(summaryGrid, item1, item2, 'wind', cWind);
    }

    // 4. Humidity & Pressure
    const hum = convertItem(obs.outHumidity, state.units);
    const press = convertItem(obs.barometer, state.units) || convertItem(obs.pressure, state.units);

    if (hum) {
        const humSummary = {
            current: getAverage(hum),
            min: hum.min,
            max: hum.max,
            unit: hum.unit,
            unit: hum.unit,
            label: 'HUMIDITY'
        };
        createDialCard(summaryGrid, humSummary, 'Humidity', cHum, 0, 100, cTextPrimary, cTextSecondary);
    }

    if (press) {
        const pressLimits = (state.units.pressure === 'inHg') ? { min: 28, max: 31 } : { min: 950, max: 1050 };
        const pressSummary = {
            current: getAverage(press),
            min: press.min,
            max: press.max,
            unit: press.unit,
            unit: press.unit,
            label: 'PRESSURE'
        };
        createGaugeCard(summaryGrid, pressSummary, 'Pressure', cPress, pressLimits.min, pressLimits.max, cTextPrimary, cTextSecondary);
    }

    if (window.lucide) window.lucide.createIcons();
}

function createSummaryCard(container, label, value, unit, color) {
    const div = document.createElement('div');
    div.className = 'card';

    let icon = 'activity';
    const lowLabel = label.toLowerCase();
    if (lowLabel.includes('rain')) icon = 'cloud-rain';
    if (lowLabel.includes('wind') || lowLabel.includes('gust')) icon = 'wind';
    if (lowLabel.includes('temp')) icon = 'thermometer';
    if (lowLabel.includes('pressure')) icon = 'gauge';
    if (lowLabel.includes('uv')) icon = 'sun';

    div.innerHTML = `
        <div class="card-header card-header-centered">
             <span class="card-label" style="color:${color}">${label}</span>
             <i data-lucide="${icon}" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <div class="card-content-centered">
            <div class="card-value value-display-md" style="background-image: linear-gradient(180deg, ${color}, ${hexToRgbA(color, 0.7)});">
                ${(+value).toFixed(label.toLowerCase().includes('rain') ? 2 : 1)}<span class="card-unit unit-inline-sm">${unit}</span>
            </div>
        </div>
    `;
    // div.style.justifyContent = 'center'; // Removed
    container.appendChild(div);
}
