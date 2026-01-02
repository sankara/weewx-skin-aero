// events.js
import { state, els } from './state.js';
import { renderHeader, renderHistorySummary } from './ui.js';
import { renderGraphs } from './charts.js';
import { loadDate } from './app.js';

export function setupNav() {
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

export function setupUnits() {
    const btn = document.getElementById('unit-toggle');
    if (!btn) return;

    const updateLabel = () => {
        const label = state.units === 'metric' ? '°F' : '°C';
        btn.innerHTML = `<span class="unit-text" style="font-weight: 700; font-size: 0.9rem;">${label}</span>`;
    };

    updateLabel();

    btn.addEventListener('click', () => {
        state.units = state.units === 'metric' ? 'imperial' : 'metric';
        localStorage.setItem('aero_units', state.units);
        updateLabel();
        renderHeader();
        renderHistorySummary();
        renderGraphs();
    });
}

export function setupDateControls() {
    els.datePrev.addEventListener('click', () => {
        const d = new Date(state.currentDate);
        if (state.viewScope === 'day') d.setDate(d.getDate() - 1);
        else if (state.viewScope === 'week') d.setDate(d.getDate() - 7);
        else if (state.viewScope === 'month') d.setMonth(d.getMonth() - 1);
        else if (state.viewScope === 'year') d.setFullYear(d.getFullYear() - 1);
        loadDate(d);
    });

    const todayBtn = document.getElementById('date-today');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            loadDate(new Date());
        });
    }

    els.dateNext.addEventListener('click', () => {
        const d = new Date(state.currentDate);
        if (state.viewScope === 'day') d.setDate(d.getDate() + 1);
        else if (state.viewScope === 'week') d.setDate(d.getDate() + 7);
        else if (state.viewScope === 'month') d.setMonth(d.getMonth() + 1);
        else if (state.viewScope === 'year') d.setFullYear(d.getFullYear() + 1);

        const now = new Date();
        if (d > now && state.viewScope !== 'year') return;

        loadDate(d);
    });
}

export function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const updateIcon = (isDark) => {
        const iconName = isDark ? 'sun' : 'moon';
        btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        if (window.lucide) window.lucide.createIcons();
    };

    const isDark = document.documentElement.classList.contains('dark');
    updateIcon(isDark);

    const updateThemeColor = (isDark) => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', isDark ? '#0f172a' : '#e0eafc');
        }
    };

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
        updateThemeColor(nextState);

        renderHeader();
        renderHistorySummary();
        renderGraphs();
    });
}

export function setupDesign() {
    const btn = document.getElementById('design-toggle');
    if (!btn) return;

    const updateIcon = (isAero) => {
        const iconName = isAero ? 'layout-template' : 'sparkles';
        btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        if (window.lucide) window.lucide.createIcons();
    };

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
export function setupPullToRefresh() {
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
            // e.preventDefault(); // Can break scroll if not careful
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

            // Trigger reload
            // In a real app, we'd call app.init() or reload our specific data
            // Since this is a SPA, we can just reload the current date and current data
            try {
                // Refresh logic here (simplified as window reload for now, or calling init)
                // Better: window.location.reload();
                // But let's try to be smooth.
                await new Promise(r => setTimeout(r, 800)); // Visual feedback
                window.location.reload();
            } catch (e) {
                console.error("Refresh failed", e);
            }
        }

        // Reset
        ptr.style.transform = '';
        appContainer.style.transform = '';
        ptr.classList.remove('ptr-pulling', 'ptr-loading');
        ptrText.textContent = 'Pull to refresh';
        document.body.classList.remove('ptr-active');
    });
}
