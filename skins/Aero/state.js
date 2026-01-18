// state.js
export const state = {
    currentData: null,
    activeData: null,
    forecastData: null,
    view: 'overview',
    viewScope: 'day',
    units: loadUnits(),
    design: localStorage.getItem('design') === 'aero' ? 'aero' : 'simple',
    currentDate: null,
    basePath: 'data/'
};

export const els = {
    title: document.getElementById('station-title'),
    lastUpdated: document.getElementById('last-updated'),
    grid: document.getElementById('observations-grid'),
    graphs: document.getElementById('graphs-container'),
    forecast: document.getElementById('forecast-container'),
    navBtns: document.querySelectorAll('.nav-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    dateDisplay: document.getElementById('current-date-display'),
    datePrev: document.getElementById('date-prev'),
    dateNext: document.getElementById('date-next'),
    // Modal Elements
    settingsModal: document.getElementById('settings-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    modalOverlay: document.getElementById('modal-overlay'),
};

function loadUnits() {
    const stored = localStorage.getItem('aero_units_config');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error("Failed to parse stored units", e);
        }
    }

    // Default based on browser locale
    const isUS = navigator.language === 'en-US';
    return isUS ? {
        temp: '°F',
        speed: 'mph',
        pressure: 'inHg',
        rain: 'in',
        rainRate: 'in/h'
    } : {
        temp: '°C',
        speed: 'km/h',
        pressure: 'hPa',
        rain: 'mm',
        rainRate: 'mm/h'
    };
}
