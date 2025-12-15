// ui.js
import { els, state } from './state.js';
import { THEME, convertItem, getAverage, isSameDay } from './utils.js';
import { drawDial } from './charts.js';

export function renderHeader() {
    if (!state.currentData) return;
    els.title.textContent = "Aero Weather";
    const date = new Date(state.currentData.meta.time * 1000);
    els.lastUpdated.textContent = `Updated: ${date.toLocaleTimeString()}`;
}

export function renderOverview() {
    els.grid.innerHTML = '';

    // Determine if we are viewing the "latest" day (Today)
    const reportDate = new Date(state.currentData.meta.time * 1000);
    const isToday = isSameDay(state.currentDate, reportDate);

    // activeData is the log for the period (Day, Week, Month)
    // currentData is the LIVE point-in-time data
    const activeObs = state.activeData.obs;
    const currentObs = state.currentData.obs;

    // Helper to prepare display item
    const getDisplayItem = (key) => {
        const activeItem = activeObs[key];
        const currentItem = currentObs[key];

        if (!activeItem) return convertItem(currentItem, state.units);

        // LOGIC FIX:
        // Use activeItem (historical log) for min/max/avg logic base.
        // If "Today", show Current value as main number.
        // If Past/Week/Month, show Average (or Sum for rain) as main number.

        let displayVal;
        let labelSuffix = '';

        if (isToday && state.viewScope === 'day') {
            displayVal = currentItem ? currentItem.current : activeItem.current;
        } else {
            // Historical or Wide View
            displayVal = getAverage(activeItem);
            labelSuffix = 'Avg';
        }

        // Create a synthetic item 
        const synthetic = {
            ...activeItem, // Inherit min, max, unit
            current: displayVal,
            label: (currentItem ? currentItem.label : activeItem.label) + (labelSuffix ? ` (${labelSuffix})` : '')
        };

        return convertItem(synthetic, state.units);
    };

    // Dials: Temp, Humidity, Pressure, UV
    const limits = {
        temp: state.units === 'imperial' ? { min: 0, max: 120 } : { min: -20, max: 50 },
        pressure: state.units === 'imperial' ? { min: 28, max: 31 } : { min: 950, max: 1050 }
    };

    createDialCard(getDisplayItem('outTemp'), 'Temperature', THEME.outTemp, limits.temp.min, limits.temp.max);
    createDialCard(getDisplayItem('outHumidity'), 'Humidity', THEME.humidity, 0, 100);
    createDialCard(getDisplayItem('barometer') || getDisplayItem('pressure'), 'Pressure', THEME.pressure, limits.pressure.min, limits.pressure.max);
    createDialCard(getDisplayItem('UV'), 'UV Index', THEME.uv, 0, 15);

    // Text Cards: Wind, Rain
    const windItem = getDisplayItem('windSpeed');
    // If not today, wind might be average? Or max gust? 
    // Standard practice for summary is Avg Speed. 
    createCard(windItem, 'wind', THEME.windSpeed, '');

    // Rain: (Total)
    // Always show Sum for Rain
    const rainItem = convertItem(activeObs.rain, state.units);
    // Ensure display value is sum if available
    if (rainItem.sum !== undefined) rainItem.current = rainItem.sum;

    createCard(rainItem, 'rain', THEME.rainRate, 'Total');

    if (window.lucide) window.lucide.createIcons();
}

export function createDialCard(item, title, color, absMin, absMax) {
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
    els.grid.appendChild(div);

    const canvas = div.querySelector('canvas');
    // Ensure min/max exist
    const dailyMin = item.min !== undefined ? item.min : item.current;
    const dailyMax = item.max !== undefined ? item.max : item.current;

    drawDial(canvas, absMin, absMax, item.current, dailyMin, dailyMax, item.unit, color, title);
}

export function createCard(item, type, color, labelSuffix = '') {
    if (!item) return;

    let icon = 'activity';
    if (type === 'wind') { icon = 'wind'; }
    if (type === 'rain') { icon = 'cloud-rain'; }

    const val = item.current !== undefined ? (+item.current).toFixed(1) : '-';
    // Label handled by getDisplayItem mostly, but redundancy is safe
    const label = (item.label || item.observation || type) + (labelSuffix ? ` (${labelSuffix})` : '');

    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
        <div class="card-header">
            <span class="card-label">${label}</span>
            <i data-lucide="${icon}" style="width:18px; height:18px; color:${color}"></i>
        </div>
        <div class="card-value" style="background: linear-gradient(180deg, ${color}, ${color}aa); -webkit-background-clip: text;">
            ${val}<span class="card-unit">${item.unit}</span>
        </div>
    `;
    els.grid.appendChild(div);
}
