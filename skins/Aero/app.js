// app.js
import { renderHeader, renderHistorySummary } from './ui.js';
import { renderGraphs } from './charts.js';
import { isSameDay } from './utils.js';
import { state, els } from './state.js';

async function init() {
    try {
        console.log("Init...");
        // 1. Fetch "Current" (Live) data AND "Today" data (for context)
        // We need 'today.json' for the Min/Max ranges on the current dials
        const curRes = await fetch(state.basePath + 'current.json');
        if (!curRes.ok) throw new Error(`HTTP ${curRes.status} loading current.json`);

        const curJson = await curRes.json();
        state.currentData = parseWeeWXData(curJson);

        // Fetch Today's data with fallback
        let todayJson = null;
        try {
            const res = await fetch(state.basePath + 'today.json');
            if (res.ok) {
                todayJson = await res.json();
            } else {
                throw new Error("today.json not found");
            }
        } catch (e) {
            // Fallback to dated file (e.g., day-YYYY-MM-DD.json)
            // Use current report time as reference for "Today"
            const reportDate = new Date(state.currentData.meta.time * 1000);
            const yyyy = reportDate.getFullYear();
            const mm = String(reportDate.getMonth() + 1).padStart(2, '0');
            const dd = String(reportDate.getDate()).padStart(2, '0');
            const fallbackFile = `day-${yyyy}-${mm}-${dd}.json`;
            console.warn(`today.json failed, trying fallback: ${fallbackFile}`);

            try {
                const res = await fetch(state.basePath + fallbackFile);
                if (res.ok) todayJson = await res.json();
            } catch (err) {
                console.warn("Fallback failed", err);
            }
        }

        if (todayJson) {
            state.todayData = parseWeeWXData(todayJson);
        }

        // Default to latest report time
        const reportTime = new Date(state.currentData.meta.time * 1000);
        state.currentDate = reportTime;

        // Render Fixed Top Section
        renderHeader();

        // 2. Load "Active" data (Default: Day)
        await loadDate(state.currentDate);

        setupNav();
        setupUnits();
        setupDateControls();

    } catch (e) {
        console.error("Failed to init", e);
        // Fallback error UI
        if (els.graphs) {
            els.graphs.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; padding:2rem; color:red">
                <h3>Error loading weather data</h3>
                <p>Could not load initial data.</p>
                <p><small>${e.message}</small></p>
            </div>`;
        }
    }
}

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

async function loadDate(date) {
    state.currentDate = date;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const isToday = isSameDay(date, new Date());

    let activeFile;
    // For historical week, we need to handle it differently (aggregation)
    if (state.viewScope === 'week' && !isToday) {
        loadWeeklyData(date);
        return;
    }

    const fileMap = {
        'day': isToday ? 'today.json' : `day-${dateStr}.json`,
        'week': 'week-to-date.json', // Only used for current week now
        'month': isToday ? 'month.json' : `month-${yyyy}-${mm}.json`,
        'year': isToday ? 'year.json' : `year-${yyyy}.json`
    };

    activeFile = fileMap[state.viewScope] || 'today.json';

    // Update Date Display Text
    updateDateDisplay(date);

    // Enable/Disable Nav buttons
    updateNavControls(date, isToday);

    // Fetch Data
    try {
        // If we already have todayData and we are viewing today, reuse it?
        // Better to re-fetch if we want to support refresh, but for static file logic:
        if (state.viewScope === 'day' && isToday && state.todayData) {
            state.activeData = state.todayData;
        } else {
            let res = await fetch(state.basePath + activeFile);

            // Fallback for 'today.json' 404 in day view
            if (!res.ok && activeFile === 'today.json') {
                const fallbackFile = `day-${dateStr}.json`;
                console.warn(`today.json failed in loadDate, trying ${fallbackFile}`);
                res = await fetch(state.basePath + fallbackFile);
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            state.activeData = parseWeeWXData(data);
        }

        renderHistorySummary();
        renderGraphs();
        updateDateDisplay(date);

    } catch (e) {
        console.warn("No data for", activeFile, e);
        if (els.graphs) {
            els.graphs.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; padding:2rem;">
                No data available for ${activeFile} <br>
                <small>${e.message}</small>
            </div>`;
        }
        // Clear summary if no data
        if (document.getElementById('history-summary')) {
            document.getElementById('history-summary').innerHTML = '';
        }
    }
}

function updateDateDisplay(date) {
    if (state.viewScope === 'day') {
        els.dateDisplay.textContent = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    } else if (state.viewScope === 'month') {
        els.dateDisplay.textContent = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else if (state.viewScope === 'year') {
        els.dateDisplay.textContent = date.getFullYear();
    } else if (state.viewScope === 'week') {
        if (state.activeData && state.activeData.meta && state.activeData.meta.startTimestamp) {
            const start = new Date(state.activeData.meta.startTimestamp * 1000);
            const end = new Date(state.activeData.meta.endTimestamp * 1000);
            const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            els.dateDisplay.textContent = `${startStr} - ${endStr}`;
        } else {
            els.dateDisplay.textContent = "Current Week";
        }
    }
}

function updateNavControls(date, isToday) {
    els.datePrev.disabled = false;
    els.datePrev.style.opacity = '1';

    const now = new Date();
    const isFuture = (date > now);

    if (state.viewScope === 'week') {
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - now.getDay());
        lastSunday.setHours(0, 0, 0, 0);

        const currentInWeek = new Date(date);
        currentInWeek.setHours(0, 0, 0, 0);

        // Disable next if we are in the current week
        els.dateNext.disabled = (currentInWeek >= lastSunday);
    } else if (state.viewScope === 'month') {
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        if (date.getFullYear() > currentYear || (date.getFullYear() === currentYear && date.getMonth() >= currentMonth)) {
            els.dateNext.disabled = true;
        } else {
            els.dateNext.disabled = false;
        }
    } else if (state.viewScope === 'year') {
        if (date.getFullYear() >= now.getFullYear()) {
            els.dateNext.disabled = true;
        } else {
            els.dateNext.disabled = false;
        }
    } else {
        els.dateNext.disabled = (isToday || isFuture);
    }

    els.dateNext.style.opacity = els.dateNext.disabled ? '0.3' : '1';
}

async function loadWeeklyData(targetDate) {
    // 1. Determine Monday-Sunday for this targetDate
    const d = new Date(targetDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
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
        promises.push(fetch(`${state.basePath}${fname}`).then(r => r.ok ? r.json() : null));
    }

    try {
        const results = await Promise.all(promises);
        // Aggregate
        const weekData = {
            meta: {
                // Approximate timestamps from first and last
                startTimestamp: monday.getTime() / 1000,
                endTimestamp: (monday.getTime() + 7 * 24 * 3600 * 1000) / 1000,
                time: targetDate.toLocaleDateString()
            },
            observations: []
        };

        // Helper to merge series
        const mergeSeries = (obsName) => {
            let combined = [];
            results.forEach(day => {
                if (!day) return;
                const obs = day.observations.find(o => o.observation === obsName);
                if (obs && obs.graph) combined = combined.concat(obs.graph);
            });
            return combined;
        };

        // Observations to reconstruct
        const obsList = ['outTemp', 'outHumidity', 'barometer', 'windSpeed', 'windDir', 'rain'];
        obsList.forEach(name => {
            const series = mergeSeries(name);
            const entry = { observation: name, graph: series };
            // Simple aggregations for min/max/sum
            // extracting from series is safer/easier than summing daily stats if daily stats are missing
            if (name === 'rain') {
                entry.sum = results.reduce((acc, r) => {
                    const o = r ? r.observations.find(x => x.observation === 'rain') : null;
                    return acc + (o ? (parseFloat(o.sum) || 0) : 0);
                }, 0);
            }
            // For others, min/max could be calculated from series or day stats. 
            // Leaving simplified for now as charts rely on series mainly.
            weekData.observations.push(entry);
        });

        const parsed = parseWeeWXData(weekData);
        state.activeData = parsed.meta; // Fix: parseWeeWXData return structure

        // Wait, parseWeeWXData returns { meta:..., obs:... }
        // We need to match that structure manually or reuse it.
        // Let's just manually shape state.activeData for renderGraphs
        // Actually renderGraphs expects state.activeData to be the full object with .obs and .meta
        state.activeData = parsed;

        renderHeader(parsed);
        renderGraphs(parsed);
        // renderHistorySummary(parsed); // Optional, might need more stats
        updateDateDisplay(targetDate);
        updateNavControls(targetDate, false);

    } catch (e) {
        console.error("Failed to load weekly data", e);
    }
}

function setupNav() {
    const mobileSelect = document.getElementById('mobile-view-select');

    // Desktop Buttons
    els.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view; // day, week, month, year
            state.viewScope = view;

            // Sync mobile select
            if (mobileSelect) mobileSelect.value = view;

            // Reset date to 'latest' when switching views?
            const d = state.currentData ? new Date(state.currentData.meta.time * 1000) : new Date();
            loadDate(d);
        });
    });

    // Mobile Select
    if (mobileSelect) {
        mobileSelect.addEventListener('change', (e) => {
            const view = e.target.value;
            state.viewScope = view;

            // Sync desktop buttons
            els.navBtns.forEach(b => {
                if (b.dataset.view === view) b.classList.add('active');
                else b.classList.remove('active');
            });

            const d = state.currentData ? new Date(state.currentData.meta.time * 1000) : new Date();
            loadDate(d);
        });
    }
}

function setupUnits() {
    const btn = document.getElementById('unit-toggle');
    if (!btn) return;

    const updateLabel = () => {
        // Show what we will switch TO
        const label = state.units === 'metric' ? '°F' : '°C';
        btn.innerHTML = `<span class="unit-text" style="font-weight: 700; font-size: 0.9rem;">${label}</span>`;
    };

    // Initial state
    updateLabel();

    btn.addEventListener('click', () => {
        state.units = state.units === 'metric' ? 'imperial' : 'metric';
        updateLabel();
        renderHeader();
        renderHistorySummary();
        renderGraphs();
    });
}

function setupDateControls() {
    els.datePrev.addEventListener('click', () => {
        const d = new Date(state.currentDate);
        if (state.viewScope === 'day') d.setDate(d.getDate() - 1);
        if (state.viewScope === 'week') d.setDate(d.getDate() - 7);
        if (state.viewScope === 'month') d.setMonth(d.getMonth() - 1);
        if (state.viewScope === 'year') d.setFullYear(d.getFullYear() - 1);
        loadDate(d);
    });

    els.dateNext.addEventListener('click', () => {
        const d = new Date(state.currentDate);
        if (state.viewScope === 'day') d.setDate(d.getDate() + 1);
        if (state.viewScope === 'week') d.setDate(d.getDate() + 7);
        if (state.viewScope === 'month') d.setMonth(d.getMonth() + 1);
        if (state.viewScope === 'year') d.setFullYear(d.getFullYear() + 1);

        // Basic future check
        const now = new Date();
        if (d > now && state.viewScope !== 'year') return; // Allow year if current year?

        loadDate(d);
    });
}

function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const updateIcon = (isDark) => {
        // Icon: Sun if Dark (switch to light), Moon if Light (switch to dark)
        const iconName = isDark ? 'sun' : 'moon';
        btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
    };

    // Initial State Check
    const isDark = document.documentElement.classList.contains('dark');
    updateIcon(isDark);

    btn.addEventListener('click', () => {
        const isDarkNow = document.documentElement.classList.contains('dark');
        const nextState = !isDarkNow;

        if (nextState) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
        updateIcon(nextState);

        // Re-render UI to update Canvas elements (Dials) with new colors
        renderHeader();
        renderHistorySummary();
        renderGraphs();
    });
}

function setupDesign() {
    const btn = document.getElementById('design-toggle');
    if (!btn) return;

    const updateIcon = (isAero) => {
        // Icon: Sparkles (if Aero active, or to switch to Aero?), Layout (if Simple active)
        // Let's use logic: Show current state icon? Or switch to?
        // Theme uses "Switch To". 
        // Simple Top -> Layout. Aero Top -> Sparkles.
        // If Simple: Show Sparkles (Switch to Aero).
        // If Aero: Show Layout (Switch to Simple).
        const iconName = isAero ? 'layout-template' : 'sparkles';
        btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        if (window.lucide) window.lucide.createIcons();
    };

    // Load preference
    const saved = localStorage.getItem('design');
    if (saved === 'aero') {
        document.documentElement.classList.add('theme-aero');
        state.design = 'aero';
    } else {
        state.design = 'simple';
    }
    updateIcon(state.design === 'aero');

    btn.addEventListener('click', () => {
        const isAero = document.documentElement.classList.toggle('theme-aero');
        state.design = isAero ? 'aero' : 'simple';
        localStorage.setItem('design', state.design);
        updateIcon(isAero);
    });
}

// Start
// Start
setupDesign();
setupTheme(); // Initialize theme immediately, independent of data loading
init();
