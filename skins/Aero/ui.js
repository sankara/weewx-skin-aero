import { els, state } from './state.js';
import { convertItem, getAverage, hexToRgbA, resolveThemeColor, isSameDay } from './utils.js';
import { drawCompass, drawDial, drawGauge } from './charts.js';

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
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', `${title}: ${item.current} ${item.unit}`);

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">${title}</span>
            <i data-lucide="gauge" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <canvas width="280" height="260" class="dial-canvas" role="img" aria-label="${title} gauge showing ${item.current} ${item.unit}"></canvas>
        <span class="sr-only">${title}: ${item.current} ${item.unit}</span>
    `;
    container.appendChild(div);

    if (title === 'Pressure') {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
            const target = document.getElementById('graph-pressure-container');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    const canvas = div.querySelector('canvas');
    drawGauge(canvas, absMin, absMax, item.current, item.unit, color, null, textPrimary, textSecondary);
}

function createDialCard(container, item, title, color, absMin, absMax, textPrimary, textSecondary) {
    if (!item || item.current === null || item.current === undefined) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', `${title}: ${item.current} ${item.unit}`);

    let icon = 'thermometer';
    if (title.toLowerCase().includes('humidity')) icon = 'droplets';
    if (title.toLowerCase().includes('uv')) icon = 'sun';

    const minMaxText = (item.min !== undefined && item.max !== undefined)
        ? `, range ${item.min} to ${item.max} ${item.unit}`
        : '';

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">${item.label || title}</span>
            <i data-lucide="${icon}" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <canvas width="280" height="260" class="dial-canvas" role="img" aria-label="${title} dial showing ${item.current} ${item.unit}${minMaxText}"></canvas>
        <span class="sr-only">${title}: ${item.current} ${item.unit}${minMaxText}</span>
    `;
    container.appendChild(div);

    let targetId = '';
    if (title === 'Temperature') targetId = 'graph-temp-container';
    if (title === 'Humidity') targetId = 'graph-humidity-container';
    
    if (targetId) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    const canvas = div.querySelector('canvas');
    const dailyMin = item.min !== undefined && item.min !== null ? item.min : item.current;
    const dailyMax = item.max !== undefined && item.max !== null ? item.max : item.current;

    drawDial(canvas, absMin, absMax, item.current, dailyMin, dailyMax, item.unit, color, title, textPrimary, textSecondary);
}

function createCompassCard(container, speedItem, gustItem, dirItem, color, textPrimary, textSecondary, theme) {
    if (!speedItem || speedItem.current === null) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', `Wind: ${speedItem.current} ${speedItem.unit}`);

    const speed = speedItem.current;
    const gust = gustItem ? gustItem.current : null;
    const dir = dirItem ? dirItem.current : null;
    const unit = speedItem.unit;

    const gustText = gust !== null ? `, gusting to ${gust} ${unit}` : '';
    const dirText = dir !== null ? ` from ${dir}°` : '';

    div.innerHTML = `
        <div class="card-header card-header-centered">
            <span class="card-label">Wind</span>
            <i data-lucide="wind" class="card-icon-sm" style="color:${color}"></i>
        </div>
        <canvas width="280" height="260" class="dial-canvas" role="img" aria-label="Wind compass showing ${speed} ${unit}${gustText}${dirText}"></canvas>
        <span class="sr-only">Wind: ${speed} ${unit}${gustText}${dirText}</span>
    `;
    container.appendChild(div);

    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
        const target = document.getElementById('graph-wind-container');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });

    const canvas = div.querySelector('canvas');
    // Pass null for title
    drawCompass(canvas, speed, gust, dir, unit, color, null, textPrimary, textSecondary, theme);
}

function createCombinedCard(container, item1, item2, type, color) {
    if (!item1) return;

    let icon = 'activity';
    if (type === 'wind') {
        icon = 'wind';
    }
    if (type === 'rain') {
        icon = 'cloud-rain';
    }

    // Labels
    const label1 = item1.label || (type === 'wind' ? 'Wind Speed' : 'Rain');
    const label2 = item2 ? (item2.label || (type === 'wind' ? 'Gust' : 'Rate')) : '';

    const precision1 = type === 'rain' ? 2 : 1;
    const precision2 = type === 'rain' ? 2 : 1;

    const val1 = item1.current !== undefined ? (+item1.current).toFixed(precision1) : '-';
    const val2 = (item2 && item2.current !== undefined) ? (+item2.current).toFixed(precision2) : '-';

    const div = document.createElement('div');
    div.className = 'card';
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', `${label1}: ${val1} ${item1.unit}`);

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

    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
        let targetId = '';
        if (type === 'wind') targetId = 'graph-wind-container';
        if (type === 'rain') targetId = 'graph-rain-container';
        
        const target = document.getElementById(targetId);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
}

function createRainCard(container, totalItem, hourItem, rateItem, color) {
    if (!totalItem) return;

    const icon = 'cloud-rain';
    const valTotal = totalItem.current !== undefined ? (+totalItem.current).toFixed(2) : '-';
    const valHour = hourItem ? (hourItem.current !== undefined ? (+hourItem.current).toFixed(2) : '-') : null;
    const valRate = rateItem ? (rateItem.current !== undefined ? (+rateItem.current).toFixed(2) : '-') : null;

    const div = document.createElement('div');
    div.className = 'card';
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', `Rain total: ${valTotal} ${totalItem.unit}`);

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

    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
        const target = document.getElementById('graph-rain-container');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
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
            label: 'TEMPERATURE'
        };

        const limits = (state.units.temp === '°F' || state.units.temp === 'F') ? {
            min: 0,
            max: 120
        } : { min: -20, max: 50 };
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
            label: 'PRESSURE'
        };
        createGaugeCard(summaryGrid, pressSummary, 'Pressure', cPress, pressLimits.min, pressLimits.max, cTextPrimary, cTextSecondary);
    }

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Renders forecast view (hourly, daily, and alerts)
 */
export function renderForecast() {
    const container = els.forecast;
    if (!container) return;

    // Check if forecast data exists
    if (!state.forecastData || !state.forecastData.meta || !state.forecastData.meta.enabled) {
        container.innerHTML = `
            <div class="card forecast-unavailable" style="grid-column: 1/-1; text-align:center; padding:2rem;">
                <i data-lucide="cloud-off" style="width:48px; height:48px; margin:0 auto 1rem; opacity:0.5;"></i>
                <p style="margin:0; opacity:0.7;">Forecast data is unavailable</p>
                <p style="margin:0.5rem 0 0; font-size:0.875rem; opacity:0.5;">
                    Enable forecast in skin.conf or check your configuration
                </p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = '';

    // Render alerts if any
    if (state.forecastData.alerts && state.forecastData.alerts.length > 0) {
        renderWeatherAlerts(container, state.forecastData.alerts);
    }

    /* Hourly forecast removed to resolve overflow issues */
    /*
    if (state.forecastData.hourly && state.forecastData.hourly.length > 0) {
        renderHourlyForecast(container, state.forecastData.hourly);
    }
    */

    // Render daily forecast
    if (state.forecastData.daily && state.forecastData.daily.length > 0) {
        renderDailyForecast(container, state.forecastData.daily);
    }

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Renders weather alerts
 */
function renderWeatherAlerts(container, alerts) {
    const alertsContainer = document.createElement('div');
    alertsContainer.className = 'forecast-alerts';
    alertsContainer.style.cssText = 'grid-column: 1/-1; margin-bottom: 1rem;';

    alerts.forEach(alert => {
        const severity = alert.severity?.toLowerCase() || 'unknown';
        const severityColor = {
            'extreme': '#ef4444',
            'severe': '#f97316',
            'moderate': '#eab308',
            'minor': '#3b82f6',
            'unknown': '#6b7280'
        }[severity] || '#6b7280';

        const alertDiv = document.createElement('div');
        alertDiv.className = 'card forecast-alert';
        alertDiv.style.borderLeft = `4px solid ${severityColor}`;

        alertDiv.innerHTML = `
            <div style="display:flex; align-items:start; gap:0.75rem;">
                <i data-lucide="alert-triangle" style="color:${severityColor}; min-width:24px; margin-top:0.25rem;"></i>
                <div style="flex:1;">
                    <div style="font-weight:600; margin-bottom:0.25rem; color:${severityColor};">
                        ${alert.event || 'Weather Alert'}
                    </div>
                    <div style="font-size:0.875rem; opacity:0.9; margin-bottom:0.5rem;">
                        ${alert.headline || ''}
                    </div>
                    ${alert.instruction ? `
                        <div style="font-size:0.875rem; opacity:0.7; font-style:italic;">
                            ${alert.instruction}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        alertsContainer.appendChild(alertDiv);
    });

    container.appendChild(alertsContainer);
}

/**
 * Renders daily forecast (7 days)
 */
function renderDailyForecast(container, dailyData) {
    const section = document.createElement('div');
    section.className = 'forecast-section';
    section.style.cssText = 'grid-column: 1/-1;';

    const dailyCard = document.createElement('div');
    dailyCard.className = 'card daily-forecast-card';

    dailyData.forEach((day, index) => {
        // Parse date manually to avoid UTC timezone shifts
        // day.date is YYYY-MM-DD
        const parts = day.date.split('-');
        const date = new Date(parts[0], parts[1] - 1, parts[2]);

        const isToday = isSameDay(date, new Date());
        const dayName = isToday ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'long' });
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        // Convert temperatures to selected unit
        const rawHigh = day.tempHigh !== null && day.tempHigh !== undefined ? day.tempHigh : null;
        const rawLow = day.tempLow !== null && day.tempLow !== undefined ? day.tempLow : null;

        const tempHigh = rawHigh !== null ? convertForecastTemp(rawHigh, day.tempUnit, state.units.temp) : null;
        const tempLow = rawLow !== null ? convertForecastTemp(rawLow, day.tempUnit, state.units.temp) : null;
        const targetUnit = state.units.temp;

        const item = document.createElement('div');
        item.className = 'daily-item';

        item.innerHTML = `
            <div class="daily-day">${dayName}</div>
            <div class="daily-date">${dateStr}</div>
            <div class="daily-icon-container">
                <i data-lucide="${day.icon || 'cloud'}" class="daily-icon"></i>
            </div>
            <div class="daily-temps">
                <span class="daily-temp-high">${tempHigh !== null ? Math.round(tempHigh) + targetUnit : '--'}</span>
                <span class="daily-temp-sep">/</span>
                <span class="daily-temp-low">${tempLow !== null ? Math.round(tempLow) + targetUnit : '--'}</span>
            </div>
            <div class="daily-precip-container">
                ${(day.precipProb !== null && day.precipProb !== undefined) ? `
                    <div class="daily-precip">
                        <i data-lucide="droplets"></i>
                        <span>${day.precipProb}%</span>
                    </div>
                ` : '<div class="daily-precip" style="visibility:hidden;">&nbsp;</div>'}
            </div>
        `;

        dailyCard.appendChild(item);
    });

    section.appendChild(dailyCard);
    container.appendChild(section);

    // Add provider attribution to footer instead of inside forecast section
    const footerContent = document.getElementById('footer-content');
    if (footerContent) {
        footerContent.innerHTML = '';
        if (state.forecastData.meta.provider === 'openmeteo') {
            const attribution = document.createElement('div');
            attribution.className = 'forecast-attribution';
            attribution.innerHTML = `
                Forecast provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
            `;
            footerContent.appendChild(attribution);
        }
    }
}

function convertForecastTemp(val, sourceUnit, targetUnit) {
    if (sourceUnit === targetUnit) return val;
    if (targetUnit === '°C' && (sourceUnit === '°F' || sourceUnit === 'F')) {
        return (val - 32) * 5 / 9;
    } else if ((targetUnit === '°F' || targetUnit === 'F') && sourceUnit === '°C') {
        return val * 9 / 5 + 32;
    }
    return val;
}
