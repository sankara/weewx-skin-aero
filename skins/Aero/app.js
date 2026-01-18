// app.js

// import './style.css'; // REMOVED: CSS imported in HTML
import { state, els } from './state.js';
import { renderHeader, renderHistorySummary, renderForecast } from './ui.js';
import { renderGraphs } from './charts.js';
import { isSameDay } from './utils.js';
import { setupEvents } from './events.js';

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
 * Loads forecast data from the server.
 * Returns true if data was updated, false otherwise.
 */
async function loadForecast(silent = false) {
    try {
        const res = await fetch(`${state.basePath}forecast.json`, {
            cache: 'no-cache' // Always fetch fresh to check server-side cache
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Check if forecast is enabled and has data
        if (data.meta && data.meta.enabled && (data.hourly?.length > 0 || data.daily?.length > 0)) {
            const wasUpdated = !state.forecastData ||
                state.forecastData.meta?.timestamp !== data.meta?.timestamp;
            state.forecastData = data;
            if (!silent) console.log('Forecast data loaded:', data.meta.provider);
            return wasUpdated;
        } else {
            state.forecastData = null;
            if (!silent) console.log('Forecast feature is disabled or no data available');
            return false;
        }
    } catch (e) {
        if (!silent) console.warn("Could not load forecast data", e);
        state.forecastData = null;
        return false;
    }
}

/**
 * Periodically refresh forecast data (every 15 minutes).
 * The backend caches for 1 hour, but we check more often to pick up new data.
 */
let forecastRefreshInterval = null;
const FORECAST_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

function startForecastRefresh() {
    if (forecastRefreshInterval) return;

    forecastRefreshInterval = setInterval(async () => {
        const wasUpdated = await loadForecast(true);
        // If viewing forecast and data was updated, re-render
        if (wasUpdated && state.viewScope === 'forecast') {
            renderForecast();
            console.log('Forecast data refreshed and view updated');
        }
    }, FORECAST_REFRESH_INTERVAL);
}

function stopForecastRefresh() {
    if (forecastRefreshInterval) {
        clearInterval(forecastRefreshInterval);
        forecastRefreshInterval = null;
    }
}

/**
 * Loads and renders data for a specific date.
 */
export async function loadDate(date, skipPushState = false) {
    state.currentDate = new Date(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const isToday = isSameDay(date, new Date());

    if (!skipPushState) {
        updateRouter();
    }

    // Handle forecast view - no date-based loading needed
    if (state.viewScope === 'forecast') {
        render();
        return;
    }

    let activeFile;
    if (state.viewScope === 'day') {
        activeFile = isToday ? 'today.json' : `day-${dateStr}.json`;
    } else if (state.viewScope === 'week') {
        await loadWeeklyData(date);
        render();
        return;
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

        const obsList = ['outTemp', 'outHumidity', 'barometer', 'windSpeed', 'windGust', 'windDir', 'rain'];
        obsList.forEach(name => {
            const series = mergeSeries(name);
            const entry = { observation: name, graph: series };

            // Extract unit from first available day
            const sampleDay = results.find(day => day && day.observations.find(o => o.observation === name));
            if (sampleDay) {
                const sampleObs = sampleDay.observations.find(o => o.observation === name);
                if (sampleObs && sampleObs.unit) {
                    entry.unit = sampleObs.unit;
                }
            }

            // Calculate Stats for the Week (Min, Max, Sum, Avg)
            if (series.length > 0) {
                let min = Infinity;
                let max = -Infinity;
                let sum = 0;
                let count = 0;

                series.forEach(p => {
                    const val = (p.length >= 3) ? p[2] : p[1];
                    if (val !== null && val !== undefined) {
                        if (val < min) min = val;
                        if (val > max) max = val;
                        sum += val;
                        count++;
                    }
                });

                if (count > 0) {
                    entry.min = min;
                    entry.max = max;
                    entry.sum = sum;
                    entry.avg = sum / count;
                }
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
    // Disable date navigation for forecast view
    if (state.viewScope === 'forecast') {
        els.datePrev.disabled = true;
        els.dateNext.disabled = true;
        els.datePrev.style.opacity = '0.3';
        els.dateNext.style.opacity = '0.3';
        return;
    }

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
    if (state.viewScope === 'forecast') {
        els.dateDisplay.textContent = 'Forecast';
    } else if (state.viewScope === 'day') {
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
    updateNavButtons();

    // Handle forecast view - separate from historical
    if (state.viewScope === 'forecast') {
        // Hide historical containers, show forecast
        if (document.getElementById('history-summary')) {
            document.getElementById('history-summary').innerHTML = '';
        }
        if (els.graphs) {
            els.graphs.style.display = 'none';
        }
        if (els.forecast) {
            els.forecast.style.display = 'grid';
        }
        renderForecast();
        renderHeader();
        return;
    }

    // Show historical containers, hide forecast
    if (els.graphs) {
        els.graphs.style.display = 'grid';
    }
    if (els.forecast) {
        els.forecast.style.display = 'none';
    }

    // Handle historical data views
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

function updateNavButtons() {
    els.navBtns.forEach(btn => {
        if (btn.dataset.view === state.viewScope) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updateRouter() {
    const scope = state.viewScope;
    const date = state.currentDate;

    let hash = `#/${scope}`;

    // Forecast doesn't need date
    if (scope === 'forecast') {
        if (window.location.hash !== hash) {
            history.pushState({ scope }, '', hash);
        }
        return;
    }

    if (!date) return;

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    if (scope === 'day') hash += `/${y}-${m}-${d}`;
    else if (scope === 'week') hash += `/${y}-${m}-${d}`;
    else if (scope === 'month') hash += `/${y}-${m}`;
    else if (scope === 'year') hash += `/${y}`;

    if (window.location.hash !== hash) {
        history.pushState({ scope, date: date.getTime() }, '', hash);
    }
}

async function initRouter() {
    const handleHash = async () => {
        const hash = window.location.hash.replace('#/', '');
        if (!hash) return false;

        const parts = hash.split('/');
        const scope = parts[0];
        const dateStr = parts[1];

        // Handle forecast view
        if (scope === 'forecast') {
            state.viewScope = 'forecast';
            render();
            return true;
        }

        if (['day', 'week', 'month', 'year'].includes(scope)) {
            state.viewScope = scope;
            if (dateStr) {
                let d;
                if (scope === 'year') {
                    d = new Date(parseInt(dateStr), 0, 1);
                } else if (scope === 'month') {
                    const [y, m] = dateStr.split('-');
                    d = new Date(parseInt(y), parseInt(m) - 1, 1);
                } else {
                    const [y, m, day] = dateStr.split('-');
                    d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
                }

                if (!isNaN(d.getTime())) {
                    await loadDate(d, true); // true = avoid pushing state again
                    return true;
                }
            }
        }
        return false;
    };

    window.addEventListener('popstate', (e) => {
        if (e.state) {
            state.viewScope = e.state.scope;
            if (e.state.scope === 'forecast') {
                render();
            } else if (e.state.date) {
                loadDate(new Date(e.state.date), true);
            }
        } else {
            handleHash();
        }
    });

    return await handleHash();
}

/**
 * Application Entry Point
 */
document.addEventListener('DOMContentLoaded', async () => {
    state.basePath = 'data/';

    // Setup Events (Modal, Nav, etc.)
    setupEvents();

    // 1. ALWAYS load current data for the header dials
    try {
        const curRes = await fetch(`${state.basePath}current.json`);
        if (curRes.ok) {
            const curJson = await curRes.json();
            state.currentData = parseWeeWXData(curJson);

            // Set initial date from report time if not routed
            state.currentDate = new Date(state.currentData.meta.time * 1000);
        }

        // Fetch Today's data for context (min/max markers)
        const todayRes = await fetch(`${state.basePath}today.json`);
        if (todayRes.ok) {
            state.todayData = parseWeeWXData(await todayRes.json());
        }
    } catch (e) {
        console.warn("Minor: Could not load live current data", e);
    }

    // Load forecast data and start periodic refresh
    await loadForecast();
    startForecastRefresh();

    // 2. Router Initialization (History)
    const routed = await initRouter();

    if (!routed) {
        // If not routed, we already have current data to show
        if (state.currentDate) {
            await loadDate(state.currentDate, true);
        } else {
            // Ultimate fallback
            await loadDate(new Date(), true);
        }
    }

    if (window.lucide) window.lucide.createIcons();
});

// Global resize handler
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
});

// Pause/resume forecast refresh when page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopForecastRefresh();
    } else {
        // Resume refresh and immediately check for updates
        startForecastRefresh();
        loadForecast(true).then(wasUpdated => {
            if (wasUpdated && state.viewScope === 'forecast') {
                renderForecast();
            }
        });
    }
});
