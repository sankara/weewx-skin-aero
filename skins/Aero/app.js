// app.js
import { renderOverview, renderHeader } from './ui.js';
import { renderGraphs } from './charts.js';
import { isSameDay } from './utils.js';
import { state, els } from './state.js';

async function init() {
    try {
        console.log("Init...");
        // 1. Fetch "Current" (Live) data
        const res = await fetch(state.basePath + 'current.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        state.currentData = parseWeeWXData(json);

        // Default to latest report time
        const reportTime = new Date(state.currentData.meta.time * 1000);
        state.currentDate = reportTime;

        renderHeader();

        // 2. Load "Active" data (Default: Today)
        await loadDate(state.currentDate);

        setupNav();
        setupUnits();
        setupDateControls();

    } catch (e) {
        console.error("Failed to init", e);
        els.grid.innerHTML = `<div class="error" style="grid-column: 1/-1; text-align:center">
            <h3>Error loading weather data</h3>
            <p>Could not load ${state.basePath}current.json</p>
            <p><small>${e.message}</small></p>
        </div>`;
    }
}

function parseWeeWXData(json) {
    const map = {
        meta: json.report || {},
        obs: {}
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
        'week': isToday ? 'week.json' : 'week.json',   // WeeWX standard skin usually doesn't have hist week files easily. 
        // We will fallback to week.json for now unless we want to disable prev/next for weeks.

        'month': `month-${yyyy}-${mm}.json`,
        'year': `year-${yyyy}.json`
    };

    activeFile = fileMap[state.viewScope] || 'today.json';

    // Update Header Text based on Scope
    if (state.viewScope === 'day') {
        els.dateDisplay.textContent = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    } else if (state.viewScope === 'month') {
        els.dateDisplay.textContent = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else if (state.viewScope === 'year') {
        els.dateDisplay.textContent = date.getFullYear();
    } else {
        els.dateDisplay.textContent = "Current Week"; // Dynamic week text is complex without start/end
    }

    // Enable/Disable Nav buttons (Allow browsing for Month/Year now)
    if (state.viewScope === 'week') {
        els.datePrev.disabled = true; // Historical week files not standard
        els.dateNext.disabled = true;
    } else {
        els.datePrev.disabled = false;
        els.dateNext.disabled = false;
    }

    // Fetch Data
    try {
        if (state.viewScope === 'day' && isToday) {
            const [cur, today] = await Promise.all([
                fetch(state.basePath + 'current.json').then(r => r.json()),
                fetch(state.basePath + 'today.json').then(r => r.json())
            ]);
            state.currentData = parseWeeWXData(cur);
            state.activeData = parseWeeWXData(today);
        } else {
            const res = await fetch(state.basePath + activeFile);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            state.activeData = parseWeeWXData(data);
        }

        renderOverview();
        renderGraphs();

    } catch (e) {
        console.warn("No data for", activeFile, e);
        els.graphs.innerHTML = `<div class="card" style="text-align:center; padding:2rem;">
            No data available for ${activeFile} <br>
            <small>${e.message}</small>
        </div>`;
    }
}

function setupNav() {
    els.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            els.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view;
            if (view === 'overview') {
                state.viewScope = 'day';
                const d = state.currentData ? new Date(state.currentData.meta.time * 1000) : new Date();
                loadDate(d);
            } else {
                state.viewScope = view; // week, month, year
                loadDate(state.currentDate);
            }
        });
    });
}

function setupUnits() {
    els.unitToggle.addEventListener('change', (e) => {
        state.units = e.target.checked ? 'imperial' : 'metric';
        renderOverview();
        renderGraphs();
    });
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

        // Prevent going into future
        const now = new Date();
        // Simple future check: month/year > now
        if (d > now) return;

        loadDate(d);
    });
}

// Start
init();
