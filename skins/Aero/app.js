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
        const [curRes, todayRes] = await Promise.all([
            fetch(state.basePath + 'current.json'),
            fetch(state.basePath + 'today.json').catch(e => null) // Optional fail-safe
        ]);

        if (!curRes.ok) throw new Error(`HTTP ${curRes.status} loading current.json`);

        const curJson = await curRes.json();
        state.currentData = parseWeeWXData(curJson);

        if (todayRes && todayRes.ok) {
            const todayJson = await todayRes.json();
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
        if(els.graphs) {
            els.graphs.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; padding:2rem; color:red">
                <h3>Error loading weather data</h3>
                <p>Could not load initial data.</p>
                <p><small>${e.message}</small></p>
            </div>`;
        }
    }
}

function parseWeeWXData(json) {
    if(!json) return null;
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
        'week': 'week-to-date.json', // As per plan, use week-to-date
        'month': `month-${yyyy}-${mm}.json`,
        'year': `year-${yyyy}.json`
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
            const res = await fetch(state.basePath + activeFile);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            state.activeData = parseWeeWXData(data);
        }

        renderHistorySummary();
        renderGraphs();

    } catch (e) {
        console.warn("No data for", activeFile, e);
        if(els.graphs) {
            els.graphs.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; padding:2rem;">
                No data available for ${activeFile} <br>
                <small>${e.message}</small>
            </div>`;
        }
        // Clear summary if no data
        if(document.getElementById('history-summary')) {
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
        els.dateDisplay.textContent = "Current Week";
    }
}

function updateNavControls(date, isToday) {
    // Week view doesn't support historical nav yet
    if (state.viewScope === 'week') {
        els.datePrev.disabled = true;
        els.dateNext.disabled = true;
    } else {
        els.datePrev.disabled = false;
        // Disable Next if future?
        // Simple logic handled in click handler, but visual disable:
        // We can't easily know if 'next month' is future without checking current date vs today
        const now = new Date();
        // Loose check
        els.dateNext.disabled = (date > now);
        if(state.viewScope === 'day' && isToday) els.dateNext.disabled = true;
    }
}

function setupNav() {
    els.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view; // day, week, month, year
            state.viewScope = view;

            // Reset date to 'latest' when switching views?
            // Usually good UX to jump to "Current Month" if switching Day -> Month
            const d = state.currentData ? new Date(state.currentData.meta.time * 1000) : new Date();
            loadDate(d);
        });
    });
}

function setupUnits() {
    if(!els.unitToggle) return;
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

// Start
init();
