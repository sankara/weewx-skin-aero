// app.js

import './style.css';
import { state, els } from './state.js';
import { renderHeader, renderHistorySummary } from './ui.js';
import { renderGraphs, initWebglIfNeeded } from './charts.js';
import { isSameDay } from './utils.js';
import { setupNav, setupUnits, setupDateControls, setupTheme, setupDesign } from './events.js';

/**
 * Parses WeeWX JSON data into a standard internal format.
 */
function parseWeeWXData(json) {
    if (!json) return null;
    const map = {
        meta: json.meta || json.report || {},
        obs: {},
        title: json.title
    };
    if (!map.meta.time && json.time) map.meta.time = json.time;

    if (json.observations) {
        json.observations.forEach(item => {
            if (item && item.observation) {
                map.obs[item.observation] = item;
            }
        });
    }
    return map;
}

/**
 * Loads and renders data for a specific date.
 */
export async function loadDate(date) {
    state.currentDate = new Date(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const isToday = isSameDay(date, new Date());

    let activeFile;
    if (state.viewScope === 'day') {
        activeFile = isToday ? 'today.json' : `day-${dateStr}.json`;
    } else if (state.viewScope === 'week') {
        if (isToday) {
            activeFile = 'week-to-date.json';
        } else {
            await loadWeeklyData(date);
            render();
            return;
        }
    } else if (state.viewScope === 'month') {
        activeFile = isToday ? 'month.json' : `month-${y}-${m}.json`;
    } else if (state.viewScope === 'year') {
        activeFile = isToday ? 'year.json' : `year-${y}.json`;
    }

    try {
        let res = await fetch(`${state.basePath}${activeFile}`);

        // Fallback for missing today.json
        if (!res.ok && activeFile === 'today.json') {
            res = await fetch(`${state.basePath}day-${dateStr}.json`);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.activeData = parseWeeWXData(data);
        render();
    } catch (e) {
        console.warn("No data for", activeFile, e);
        state.activeData = null;
        render();
    }
}

/**
 * Fetches and aggregates daily files for a full week.
 */
async function loadWeeklyData(targetDate) {
    const d = new Date(targetDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const promises = [];
    for (let i = 0; i < 7; i++) {
        const temp = new Date(monday);
        temp.setDate(monday.getDate() + i);
        const y = temp.getFullYear();
        const m = String(temp.getMonth() + 1).padStart(2, '0');
        const dt = String(temp.getDate()).padStart(2, '0');
        const fname = `day-${y}-${m}-${dt}.json`;
        promises.push(
            fetch(`${state.basePath}${fname}`)
                .then(r => r.ok ? r.json() : null)
                .catch(err => {
                    console.warn(`Failed to fetch ${fname}:`, err);
                    return null;
                })
        );
    }

    try {
        const results = await Promise.all(promises);
        const weekData = {
            meta: {
                startTimestamp: monday.getTime() / 1000,
                endTimestamp: (monday.getTime() + 7 * 24 * 3600 * 1000) / 1000,
                time: targetDate.toLocaleDateString()
            },
            observations: []
        };

        const mergeSeries = (obsName) => {
            let combined = [];
            results.forEach(day => {
                if (!day) return;
                const obs = day.observations.find(o => o.observation === obsName);
                if (obs && obs.graph) combined = combined.concat(obs.graph);
            });
            return combined;
        };

        const obsList = ['outTemp', 'outHumidity', 'barometer', 'windSpeed', 'windDir', 'rain'];
        obsList.forEach(name => {
            const series = mergeSeries(name);
            const entry = { observation: name, graph: series };
            if (name === 'rain') {
                entry.sum = results.reduce((acc, r) => {
                    const o = r ? r.observations.find(x => x.observation === 'rain') : null;
                    return acc + (o ? (parseFloat(o.sum) || 0) : 0);
                }, 0);
            }
            weekData.observations.push(entry);
        });

        state.activeData = parseWeeWXData(weekData);
    } catch (e) {
        console.error("Failed to load weekly data", e);
        state.activeData = null;
    }
}

/**
 * Updates UI controls based on current state.
 */
function updateNavControls() {
    els.datePrev.disabled = false;
    els.datePrev.style.opacity = '1';

    const now = new Date();
    const date = state.currentDate;
    const isToday = isSameDay(date, now);
    const isFuture = (date > now);

    if (state.viewScope === 'week') {
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - now.getDay());
        lastSunday.setHours(0, 0, 0, 0);

        const currentInWeek = new Date(date);
        currentInWeek.setHours(0, 0, 0, 0);
        els.dateNext.disabled = (currentInWeek >= lastSunday);
    } else if (state.viewScope === 'month') {
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        els.dateNext.disabled = (date.getFullYear() > currentYear || (date.getFullYear() === currentYear && date.getMonth() >= currentMonth));
    } else if (state.viewScope === 'year') {
        els.dateNext.disabled = (date.getFullYear() >= now.getFullYear());
    } else {
        els.dateNext.disabled = (isToday || isFuture);
    }

    els.dateNext.style.opacity = els.dateNext.disabled ? '0.3' : '1';
}

/**
 * Updates the date display string in the UI.
 */
function updateDateDisplay() {
    const date = state.currentDate;
    if (state.viewScope === 'day') {
        els.dateDisplay.textContent = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    } else if (state.viewScope === 'month') {
        els.dateDisplay.textContent = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else if (state.viewScope === 'year') {
        els.dateDisplay.textContent = date.getFullYear();
    } else if (state.viewScope === 'week') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(new Date(date).setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const startStr = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const endStr = sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        els.dateDisplay.textContent = `${startStr} - ${endStr}`;
    }
}

/**
 * Orchestrates the rendering of all UI components.
 */
function render() {
    updateDateDisplay();
    updateNavControls();

    if (!state.activeData) {
        if (els.graphs) {
            els.graphs.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; padding:2rem;">
                No data available for this period.
            </div>`;
        }
        if (document.getElementById('history-summary')) {
            document.getElementById('history-summary').innerHTML = '';
        }
    } else {
        renderHistorySummary();
        renderGraphs();
    }
    renderHeader();
}

/**
 * Application Entry Point
 */
document.addEventListener('DOMContentLoaded', async () => {
    state.basePath = 'data/';

    // Initial theme/design load
    setupDesign();
    setupTheme();

    try {
        const curRes = await fetch(`${state.basePath}current.json`);
        if (!curRes.ok) throw new Error(`HTTP ${curRes.status} loading current.json`);

        const curJson = await curRes.json();
        state.currentData = parseWeeWXData(curJson);

        // Fetch Today's data for context
        try {
            const todayRes = await fetch(`${state.basePath}today.json`);
            if (todayRes.ok) {
                state.todayData = parseWeeWXData(await todayRes.json());
            }
        } catch (e) {
            console.warn("Could not load today.json for context");
        }

        // Set initial date from report time
        state.currentDate = new Date(state.currentData.meta.time * 1000);

        await loadDate(state.currentDate);

    } catch (e) {
        console.error("Initialization failed", e);
        if (els.graphs) {
            els.graphs.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; padding:2rem; color:red">
                <h3>Error loading weather data</h3>
                <p>${e.message}</p>
            </div>`;
        }
    }

    // Secondary setups
    setupNav();
    setupUnits();
    setupDateControls();

    if (window.lucide) window.lucide.createIcons();
});

// Global resize handler
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
});
