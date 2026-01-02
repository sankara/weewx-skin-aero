// state.js
export const state = {
    currentData: null,
    activeData: null,
    view: 'overview',
    viewScope: 'day',
    units: localStorage.getItem('aero_units') || 'metric',
    design: 'simple',
    currentDate: null,
    basePath: 'data/'
};

export const els = {
    title: document.getElementById('station-title'),
    lastUpdated: document.getElementById('last-updated'),
    grid: document.getElementById('observations-grid'),
    graphs: document.getElementById('graphs-container'),
    navBtns: document.querySelectorAll('.nav-btn'),
    unitToggle: document.getElementById('unit-toggle'),
    dateDisplay: document.getElementById('current-date-display'),
    datePrev: document.getElementById('date-prev'),
    dateNext: document.getElementById('date-next'),
};
