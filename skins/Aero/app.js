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
    // Map viewScope to filenames
    const fileMap = {
        'day': isToday ? 'today.json' : `day-${dateStr}.json`,
        'week': 'week-to-date.json',
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
    if (state.viewScope === 'week') {
        els.datePrev.disabled = true;
        els.dateNext.disabled = true;
        els.datePrev.style.opacity = '0.3';
        els.dateNext.style.opacity = '0.3';
    } else {
        els.datePrev.disabled = false;
        els.datePrev.style.opacity = '1';

        const now = new Date();
        const isFuture = (date > now);

        // Month view "future" check
        if (state.viewScope === 'month') {
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
    if (!els.unitToggle) return;
    els.unitToggle.addEventListener('change', (e) => {
        state.units = e.target.checked ? 'imperial' : 'metric';
        renderHeader();
        renderHistorySummary();
        renderGraphs();
    });
    // Set initial state
    els.unitToggle.checked = (state.units === 'imperial');
}

function setupDateControls() {
    els.datePrev.addEventListener('click', () => {
        const d = new Date(state.currentDate);
        if (state.viewScope === 'day') d.setDate(d.getDate() - 1);
        if (state.viewScope === 'month') d.setMonth(d.getMonth() - 1);
        if (state.viewScope === 'year') d.setFullYear(d.getFullYear() - 1);
        loadDate(d);
    });

    els.dateNext.addEventListener('click', () => {
        const d = new Date(state.currentDate);
        if (state.viewScope === 'day') d.setDate(d.getDate() + 1);
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
        // Icon should represent what you will switch TO, or the current state?
        // Usually: if dark, show Sun (to switch to light). If light, show Moon.
        // Or show current state. Let's do: Show Sun if currently Dark (so click -> light).
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

// Start
setupTheme(); // Initialize theme immediately, independent of data loading
init();
