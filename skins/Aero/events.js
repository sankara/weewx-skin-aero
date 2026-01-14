// events.js
import { state, els } from './state.js';
import { renderHeader, renderHistorySummary, renderForecast } from './ui.js';
import { renderGraphs } from './charts.js';
import { loadDate } from './app.js';

export function setupEvents() {
    setupModalEvents();
    setupNavEvents();
    setupDateEvents();
    setupPullToRefresh();
}

// --- Modal & Settings ---

function setupModalEvents() {
    // 1. Modal Toggle
    if (els.settingsBtn) {
        els.settingsBtn.addEventListener('click', openModal);
    }
    if (els.closeModalBtn) {
        els.closeModalBtn.addEventListener('click', closeModal);
    }
    if (els.modalOverlay) {
        els.modalOverlay.addEventListener('click', (e) => {
            if (e.target === els.modalOverlay) closeModal();
        });
    }

    // 2. Preset Controls
    const presetBtns = document.querySelectorAll('.preset-control .segment-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (preset === 'custom') return;
            applyPreset(preset);
        });
    });

    // 3. Granular Unit Toggles
    const unitGroups = document.querySelectorAll('.setting-item .segment-control-sm[data-type]');
    unitGroups.forEach(group => {
        const type = group.dataset.type;
        const buttons = group.querySelectorAll('button');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.val;
                if (type === 'theme') {
                    setTheme(val);
                } else if (type === 'design') {
                    setDesign(val);
                } else {
                    setUnit(type, val);
                }
                updateModalUI();
            });
        });
    });
}

function openModal() {
    updateModalUI();
    els.modalOverlay.classList.remove('hidden');
}

function closeModal() {
    els.modalOverlay.classList.add('hidden');
}

function applyPreset(preset) {
    if (preset === 'imperial') {
        state.units = {
            temp: '°F',
            speed: 'mph',
            pressure: 'inHg',
            rain: 'in',
            rainRate: 'in/h'
        };
    } else {
        state.units = {
            temp: '°C',
            speed: 'km/h',
            pressure: 'hPa',
            rain: 'mm',
            rainRate: 'mm/h'
        };
    }
    saveUnits();
    updateModalUI();
    refreshAll();
}

function setUnit(type, val) {
    state.units[type] = val;
    // Sync rain/rainRate
    if (type === 'rain') {
        state.units.rainRate = val === 'in' ? 'in/h' : 'mm/h';
    }
    saveUnits();
    refreshAll();
}

function saveUnits() {
    localStorage.setItem('aero_units_config', JSON.stringify(state.units));
}

function setTheme(val) {
    const isDark = val === 'dark';
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0f172a');
    } else {
        document.documentElement.classList.remove('dark');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#e0eafc');
    }
    localStorage.setItem('theme', val);
    refreshAll();
}

function setDesign(val) {
    state.design = val;
    if (val === 'aero') {
        document.documentElement.classList.add('theme-aero');
    } else {
        document.documentElement.classList.remove('theme-aero');
    }
    localStorage.setItem('design', val);
    refreshAll();
}

function updateModalUI() {
    const isImp = isDeepEqual(state.units, { temp: '°F', speed: 'mph', pressure: 'inHg', rain: 'in', rainRate: 'in/h' });
    const isMet = isDeepEqual(state.units, { temp: '°C', speed: 'km/h', pressure: 'hPa', rain: 'mm', rainRate: 'mm/h' });

    const presetBtns = document.querySelectorAll('.preset-control .segment-btn');
    presetBtns.forEach(btn => btn.classList.remove('active'));

    if (isImp) {
        document.querySelector('.preset-control [data-preset="imperial"]').classList.add('active');
    } else if (isMet) {
        document.querySelector('.preset-control [data-preset="metric"]').classList.add('active');
    } else {
        document.querySelector('.preset-control [data-preset="custom"]').classList.add('active');
    }

    updateToggle('temp', state.units.temp);
    updateToggle('speed', state.units.speed);
    updateToggle('pressure', state.units.pressure);
    updateToggle('rain', state.units.rain);

    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    updateToggle('theme', currentTheme);

    const currentDesign = document.documentElement.classList.contains('theme-aero') ? 'aero' : 'simple';
    updateToggle('design', currentDesign);
}

function updateToggle(type, val) {
    const group = document.querySelector(`.segment-control-sm[data-type="${type}"]`);
    if (!group) return;
    const btns = group.querySelectorAll('button');
    btns.forEach(b => {
        if (b.dataset.val === val) b.classList.add('active');
        else b.classList.remove('active');
    });
}

function isDeepEqual(obj1, obj2) {
    const k1 = Object.keys(obj1);
    const k2 = Object.keys(obj2);
    if (k1.length !== k2.length) return false;
    for (const key of k1) {
        if (obj1[key] !== obj2[key]) return false;
    }
    return true;
}

// --- Navigation ---

function setupNavEvents() {
    const mobileSelect = document.getElementById('mobile-view-select');

    els.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            els.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;
            state.viewScope = view;
            if (mobileSelect) mobileSelect.value = view;

            triggerDateLoad();
        });
    });

    if (mobileSelect) {
        mobileSelect.addEventListener('change', (e) => {
            state.viewScope = e.target.value;
            els.navBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.view === state.viewScope);
            });
            triggerDateLoad();
        });
    }
}

function setupDateEvents() {
    if (els.datePrev) {
        els.datePrev.addEventListener('click', () => changeDate(-1));
    }
    if (els.dateNext) {
        els.dateNext.addEventListener('click', () => changeDate(1));
    }
}

function changeDate(delta) {
    if (!state.currentDate) return;
    const d = new Date(state.currentDate);
    if (state.viewScope === 'day') d.setDate(d.getDate() + delta);
    else if (state.viewScope === 'week') d.setDate(d.getDate() + (delta * 7));
    else if (state.viewScope === 'month') d.setMonth(d.getMonth() + delta);
    else if (state.viewScope === 'year') d.setFullYear(d.getFullYear() + delta);

    // Check future bounds if needed, but loadDate usually handles or backend returns 404
    loadDate(d);
}

function triggerDateLoad() {
    const d = state.currentData ? new Date(state.currentData.meta.time * 1000) : new Date();
    // Maintain current date selection if possible, or reset to "now" if switching scope?
    // Usually we stay on the same "anchor" date.
    // Use state.currentDate if available
    loadDate(state.currentDate || d);
}

function refreshAll() {
    renderHeader();
    if (state.viewScope === 'forecast') {
        renderForecast();
    } else if (state.activeData) {
        renderHistorySummary();
        renderGraphs();
    }
    // Update date display via rendering cycle if needed, but app.js normally handles this via render()
}

// --- Pull to Refresh ---

function setupPullToRefresh() {
    const ptr = document.getElementById('ptr-indicator');
    const ptrText = ptr.querySelector('.ptr-text');
    const appContainer = document.querySelector('.app-container');

    let startY = 0;
    let currentY = 0;
    let pulling = false;
    const threshold = 80;

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY <= 0) {
            startY = e.touches[0].pageY;
            pulling = true;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        currentY = e.touches[0].pageY;
        const diff = currentY - startY;

        if (diff > 0 && window.scrollY <= 0) {
            const translateY = Math.min(diff * 0.5, threshold + 20);
            ptr.style.transform = `translateY(${translateY}px)`;
            appContainer.style.transform = `translateY(${translateY}px)`;
            document.body.classList.add('ptr-active');

            if (translateY >= threshold) {
                ptrText.textContent = 'Release to refresh';
                ptr.classList.add('ptr-pulling');
            } else {
                ptrText.textContent = 'Pull to refresh';
                ptr.classList.remove('ptr-pulling');
            }
        } else {
            pulling = false;
        }
    }, { passive: false });

    window.addEventListener('touchend', async () => {
        if (!pulling) return;
        pulling = false;

        const diff = currentY - startY;
        if (diff * 0.5 >= threshold) {
            ptr.classList.add('ptr-loading');
            ptrText.textContent = 'Refreshing...';
            ptr.style.transform = `translateY(${threshold}px)`;
            appContainer.style.transform = `translateY(${threshold}px)`;

            try {
                await new Promise(r => setTimeout(r, 800));
                window.location.reload();
            } catch (e) {
                console.error("Refresh failed", e);
            }
        }

        ptr.style.transform = '';
        appContainer.style.transform = '';
        ptr.classList.remove('ptr-pulling', 'ptr-loading');
        ptrText.textContent = 'Pull to refresh';
        document.body.classList.remove('ptr-active');
    });
}
