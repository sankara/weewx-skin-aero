const state = {
    currentData: null,
    activeData: null,
    view: 'overview',
    units: 'metric',
    currentDate: null,
    basePath: 'data/'
};

const THEME = {
    outTemp: '#f59e0b',
    humidity: '#0ea5e9',
    windSpeed: '#10b981',
    pressure: '#8b5cf6',
    rainRate: '#2563eb',
    uv: '#f43f5e',
    gray: '#94a3b8'
};

const els = {
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

let charts = {};

async function init() {
    try {
        const res = await fetch(state.basePath + 'current.json');
        const json = await res.json();
        state.currentData = parseWeeWXData(json);
        const reportTime = new Date(state.currentData.meta.time * 1000);
        state.currentDate = reportTime;

        renderHeader();
        // Load the daily data FIRST so we have Min/Max for dials
        await loadDate(state.currentDate);

        setupNav();
        setupUnits();
        setupDateControls();

    } catch (e) {
        console.error("Failed to init", e);
        els.grid.innerHTML = `<div class="error" style="grid-column: 1/-1; text-align:center">
            <h3>Error loading weather data</h3>
            <p>Could not load ${state.basePath}current.json</p>
        </div>`;
    }
}

function parseWeeWXData(json) {
    const map = {
        meta: json.report,
        obs: {}
    };
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
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const filename = `day-${yyyy}-${mm}-${dd}.json`;

    els.dateDisplay.textContent = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

    try {
        const res = await fetch(state.basePath + filename);
        if (!res.ok) throw new Error('No data');
        const json = await res.json();
        state.activeData = parseWeeWXData(json);

        // Re-render Overview using the loaded daily stats (min/max)
        if (state.view === 'overview') {
            renderOverview();
            renderGraphs(); // Overview also shows graphs usually
        } else if (state.view === 'day') {
            renderGraphs();
        }
    } catch (e) {
        console.warn("No data for date", filename);
        if (state.view !== 'overview') {
            els.graphs.innerHTML = `<div class="card" style="text-align:center; padding:2rem;">No data available for ${filename}</div>`;
        }
    }
}

function renderHeader() {
    if (!state.currentData) return;
    els.title.textContent = "Weather Station";
    const date = new Date(state.currentData.meta.time * 1000);
    els.lastUpdated.textContent = `Updated: ${date.toLocaleTimeString()}`;
}

function renderOverview() {
    els.grid.innerHTML = '';

    // Determine if we are viewing the "latest" day (Today)
    // state.currentData.meta.time is epoch seconds
    const reportDate = new Date(state.currentData.meta.time * 1000);
    const isToday = isSameDay(state.currentDate, reportDate);

    // Source for Min/Max/Graph is always activeData (the daily log)
    // Source for "Main Value" depends on isToday.
    const activeObs = state.activeData.obs;
    const currentObs = state.currentData.obs;

    // Helper to prepare display item
    const getDisplayItem = (key) => {
        const activeItem = activeObs[key];
        const curItem = currentObs[key];

        if (!activeItem) return curItem; // Fallback

        let displayVal;
        if (isToday) {
            displayVal = curItem ? curItem.current : activeItem.current;
        } else {
            // Calculate Average for past days
            displayVal = getAverage(activeItem);
        }

        return {
            ...activeItem, // unit, min, max
            current: displayVal,
            label: curItem ? curItem.label : activeItem.label
        };
    };

    // Dials: Temp, Humidity, Pressure, UV
    createDialCard(getDisplayItem('outTemp'), 'Temperature', THEME.outTemp, 0, 120);
    createDialCard(getDisplayItem('outHumidity'), 'Humidity', THEME.humidity, 0, 100);
    createDialCard(getDisplayItem('barometer') || getDisplayItem('pressure'), 'Pressure', THEME.pressure, 28, 31);
    createDialCard(getDisplayItem('UV'), 'UV Index', THEME.uv, 0, 15);

    // Text Cards: Wind, Rain
    // Wind: If past, Average Speed?
    // Rain: Sum is usually strictly better than "Current Rate" for overview?
    // User requested: "Show current data for current day, average for others"

    // Wind:
    const windItem = getDisplayItem('windSpeed');
    createCard(windItem, 'wind', THEME.windSpeed, isToday ? 'Current' : 'Avg');

    // Rain: Always show Total for day (Sum), Rate is less useful for "day" overview unless raining now.
    // However, sticking to User Request: Current Rate for Today? 
    // Usually Rain overview is "Daily Rain". Let's stick to Daily Rain (sum) for consistency in the text card, 
    // or Rain Rate? The original code showed Rain Rate AND Rain.
    // Let's show Rain Rate (Current) vs Average Rate? Avg Rate is 0.
    // Let's keep Rain Rate for Today, and maybe hide it for past?
    // Let's show "Precipitation" (Total) which is activeObs.rain.
    const rainItem = activeObs.rain;
    createCard(rainItem, 'rain', THEME.rainRate, 'Total');

    lucide.createIcons();
}

function createDialCard(item, title, color, absMin, absMax) {
    if (!item || item.current === undefined) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.style.alignItems = 'center';

    // Standard Card Style (No background gradient on card itself)
    div.innerHTML = `
        <div class="card-header" style="width:100%">
            <span class="card-label">${title}</span>
        </div>
        <canvas width="200" height="150"></canvas>
    `;
    els.grid.appendChild(div);

    const canvas = div.querySelector('canvas');
    // Ensure min/max exist
    const dailyMin = item.min !== undefined ? item.min : item.current;
    const dailyMax = item.max !== undefined ? item.max : item.current;

    drawDial(canvas, absMin, absMax, item.current, dailyMin, dailyMax, item.unit, color, title);
}


function drawDial(canvas, min, max, current, rangeMin, rangeMax, unit, color, title) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * 0.85;
    const radius = Math.min(w, h * 1.5) * 0.45;

    ctx.clearRect(0, 0, w, h);

    const startAngle = Math.PI * 0.85;
    const endAngle = Math.PI * 2.15;

    const getAngle = (val) => {
        const pct = (val - min) / (max - min);
        const clamped = Math.max(0, Math.min(1, pct));
        return startAngle + clamped * (endAngle - startAngle);
    };

    // 1. Background Track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.lineWidth = 15;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Active Range
    const rangeStart = getAngle(rangeMin);
    const rangeEnd = getAngle(rangeMax);

    if (Math.abs(rangeEnd - rangeStart) > 0.01) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, rangeStart, rangeEnd);
        ctx.lineWidth = 15;

        let strokeStyle = color + '66'; // Default

        if (title === 'Temperature') {
            // Create Gradient for Temperature Range
            // Left to Right gradient matching the arc
            const grad = ctx.createLinearGradient(0, h, w, h);
            grad.addColorStop(0, '#1e3a8a'); // Deep Blue
            grad.addColorStop(0.2, '#3b82f6'); // Blue
            grad.addColorStop(0.4, '#06b6d4'); // Cyan
            grad.addColorStop(0.6, '#10b981'); // Green
            grad.addColorStop(0.8, '#f97316'); // Orange
            grad.addColorStop(1, '#ef4444'); // Red
            strokeStyle = grad;
        }

        ctx.strokeStyle = strokeStyle;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // 3. Indicator
    const currentAngle = getAngle(current);
    const px = cx + radius * Math.cos(currentAngle);
    const py = cy + radius * Math.sin(currentAngle);

    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = (title === 'Temperature') ? '#f59e0b' : color; // Keep Amber ring dot for Temp
    ctx.stroke();

    // 4. Text
    ctx.textAlign = 'center';

    // Value
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillStyle = (title === 'Temperature') ? '#1e293b' : color; // Dark text for Temp, Colored for others
    ctx.fillText((+current).toFixed(1), cx, cy - radius * 0.3);

    // Unit
    ctx.font = '500 14px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(unit, cx, cy - radius * 0.3 + 20);

    // L/H
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillText(`L: ${(+rangeMin).toFixed(1)}`, cx - 50, cy + 20);
    ctx.fillText(`H: ${(+rangeMax).toFixed(1)}`, cx + 50, cy + 20);
}

function createCard(item, type, color, labelSuffix = '') {
    if (!item) return;

    let icon = 'activity';
    if (type === 'wind') { icon = 'wind'; }
    if (type === 'rain') { icon = 'cloud-rain'; }

    const val = item.current !== undefined ? (+item.current).toFixed(1) : '-';
    const label = (item.label || item.observation || type) + (labelSuffix ? ` (${labelSuffix})` : '');

    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
        <div class="card-header">
            <span class="card-label">${label}</span>
            <i data-lucide="${icon}" style="width:18px; height:18px; color:${color}"></i>
        </div>
        <div class="card-value" style="background: linear-gradient(180deg, ${color}, ${color}aa); -webkit-background-clip: text;">
            ${val}<span class="card-unit">${item.unit}</span>
        </div>
    `;
    els.grid.appendChild(div);
}

// Helpers
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function getAverage(item) {
    if (item.avg !== undefined) return item.avg;
    if (item.graph && item.graph.length > 0) {
        // Calculate approx average from graph points
        const sum = item.graph.reduce((acc, p) => acc + p[1], 0);
        return sum / item.graph.length;
    }
    // Fallback mid-range
    if (item.min !== undefined && item.max !== undefined) {
        return (item.min + item.max) / 2;
    }
    return item.current;
}

function getTempGradient(val, unit) {
    // Normalize to Celsius for coloring
    let c = val;
    if (unit === '°F' || unit === 'F') {
        c = (val - 32) * 5 / 9;
    }

    // Deep Blue (Cold) -> Red (Hot)
    // -10C -> 40C range
    // Blue: #3b82f6 (59, 130, 246)
    // Cyan: #06b6d4 (6, 182, 212)
    // Green: #10b981 (16, 185, 129)
    // Orange: #f97316 (249, 115, 22)
    // Red: #ef4444 (239, 68, 68)

    if (c < 0) return 'linear-gradient(135deg, #1e3a8a, #3b82f6)'; // Deep Blue -> Blue
    if (c < 10) return 'linear-gradient(135deg, #3b82f6, #06b6d4)'; // Blue -> Cyan
    if (c < 20) return 'linear-gradient(135deg, #06b6d4, #10b981)'; // Cyan -> Green
    if (c < 28) return 'linear-gradient(135deg, #10b981, #f97316)'; // Green -> Orange
    return 'linear-gradient(135deg, #f97316, #ef4444)'; // Orange -> Red
}

function renderGraphs() {
    els.graphs.innerHTML = '';
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    if (!state.activeData) return;

    // Common Time scale settings
    // Start of day to End of day for consistent comparison (00:00 to 24:00)
    const dayStart = new Date(state.currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(state.currentDate);
    dayEnd.setHours(24, 0, 0, 0);

    const commonScales = {
        x: {
            type: 'time',
            min: dayStart.getTime(),
            max: dayEnd.getTime(),
            time: { unit: 'hour', displayFormats: { hour: 'h a' } },
            grid: { display: false },
            ticks: {
                maxTicksLimit: 9, // 0, 3, 6, 9, 12, 15, 18, 21, 24
                font: { weight: 'bold' }
            }
        },
        y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            beginAtZero: false
        }
    };

    // 1. Temperature
    const tempItem = state.activeData.obs.outTemp;
    if (tempItem && tempItem.graph) {
        createGraphContainer('graph-temp', 'Temperature', 'graphs-container', true);
        const dataPoints = tempItem.graph.map(p => ({ x: p[0] * 1000, y: p[1] }));

        charts.temp = new Chart(document.getElementById('graph-temp').getContext('2d'), {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Temperature',
                    data: dataPoints,
                    borderColor: THEME.outTemp,
                    backgroundColor: hexToRgbA(THEME.outTemp, 0.1),
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    hitRadius: 10
                }]
            },
            options: { ...getChartOptions(), scales: commonScales }
        });
    } else {
        createNoDataContainer('Temperature');
    }

    // 2. Wind Barb Chart (Fixed Y Baseline)
    const windSpeed = state.activeData.obs.windSpeed;
    const windDir = state.activeData.obs.windDir;

    if (windSpeed && windDir && windSpeed.graph && windDir.graph) {
        // console.log("Wind Data Source:", { speedPts: windSpeed.graph.length, dirPts: windDir.graph.length });

        createGraphContainer('graph-wind', 'Wind Barbs', 'graphs-container', true);

        const dirMap = new Map(windDir.graph.map(p => [p[0], p[1]]));

        let vectorData = windSpeed.graph.map(p => {
            const ts = p[0];
            const speed = p[1]; // unit is likely mph or kph depending on skin.conf. Barbs usually Knots.
            const dir = dirMap.get(ts);
            if (dir === undefined || dir === null) return null;
            return {
                x: ts * 1000,
                y: 0, // Baseline
                speed: speed,
                dir: dir,
                // Add explicit unit for tooltip if available
                unit: windSpeed.unit
            };
        }).filter(x => x !== null);

        // Decimate to prevent bunching (e.g., every 30 mins)
        vectorData = sampleData(vectorData, 30);

        // console.log("Calculated Vector Data:", vectorData.length, vectorData[0]);

        charts.wind = new Chart(document.getElementById('graph-wind').getContext('2d'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Wind',
                    data: vectorData,
                    borderColor: THEME.windSpeed,
                    backgroundColor: THEME.windSpeed,
                    pointRadius: 4, // Show hover points
                    pointHoverRadius: 6,
                    pointBackgroundColor: THEME.windSpeed,
                    showLine: false
                }]
            },
            options: {
                ...getChartOptions(),
                scales: {
                    x: { ...commonScales.x },
                    y: {
                        display: false,
                        min: -40, max: 40
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const p = ctx.raw;
                                const compass = degToCompass(p.dir);
                                return `Wind: ${p.speed} ${p.unit || ''} (${compass})`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                afterDatasetDraw(chart) {
                    const { ctx, data } = chart;
                    const dataset = data.datasets[0];
                    const meta = chart.getDatasetMeta(0);

                    ctx.save();
                    ctx.strokeStyle = THEME.windSpeed;
                    ctx.fillStyle = THEME.windSpeed;
                    ctx.lineWidth = 2;

                    meta.data.forEach((point, index) => {
                        const raw = dataset.data[index];
                        if (!raw) return;

                        // Draw Barb
                        drawWindBarb(ctx, point.x, point.y, raw.speed, raw.dir);
                    });
                    ctx.restore();
                }
            }]
        });
    } else {
        createNoDataContainer('Wind Barbs');
    }

    // Helper functions for Wind Barbs
    function drawWindBarb(ctx, x, y, speed, dir) {
        // 1. Rotate context to wind direction
        // Standard: 0=N (Up), 90=E (Right).
        // Barb shaft points *into* the wind.
        // So if wind is FROM North (0), shaft points North (Up).
        // Canvas 0 deg is Right (East).
        // So rotation = (dir - 90) * (Math.PI / 180).

        ctx.save();
        ctx.translate(x, y);
        // dir is degrees. 
        // 0 deg (N) -> needs to point Up (-Y). 
        // Canvas 0 radians is (+X).
        // -90 deg (-PI/2) is Up.
        // So rotation angle = (dir - 90) degrees.
        const rad = (dir - 90) * (Math.PI / 180);
        ctx.rotate(rad);

        // 2. Draw Shaft
        // Length of shaft. Let's make it fixed size relative to graph, e.g., 40px.
        const length = 35;
        ctx.beginPath();
        ctx.moveTo(0, 0); // Center (Station)
        ctx.lineTo(length, 0); // Shaft extending outwards
        ctx.stroke();

        // 3. Draw Barbs/Pennants at the tail (at 'length')
        // We move backwards from the tail tip towards center for each mark.
        let pos = length;
        let speedRem = Math.round(speed / 5) * 5; // Round to nearest 5

        // Flags (50s)
        while (speedRem >= 50) {
            drawPennant(ctx, pos);
            pos -= 10; // spacing
            speedRem -= 50;
        }

        // Long Barbs (10s)
        while (speedRem >= 10) {
            drawBarbLine(ctx, pos, 10);
            pos -= 7;
            speedRem -= 10;
        }

        // Short Barb (5)
        if (speedRem >= 5) {
            // Offset slightly if we just drew a pennant/line
            // Usually short barb is a bit further down if alone? Or same spacing?
            // Standard: "The half-barb is roughly half the length of the full barb."
            drawBarbLine(ctx, pos, 5);
        }

        ctx.restore();
    }

    function drawPennant(ctx, x) {
        // Triangle filling the space between x and x-size
        // Points "inward" towards low pressure/center?
        // Standard: Triangle on the "left" side of the shaft (Northern Hemisphere standard).
        // "Left" relative to the shaft pointing away from center.
        // If shaft goes (0,0) to (L,0), "Left" is -Y coordinates.
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 6, -10); // Tip of triangle
        ctx.lineTo(x - 12, 0); // Base on shaft
        ctx.fill();
    }

    function drawBarbLine(ctx, x, type) {
        // Line of length 10 or 5 projecting to "left" (-Y).
        // Usually angled back slightly (e.g. 60-var deg), not 90 deg.
        const barbLen = (type === 10) ? 14 : 7;
        const angle = -120 * (Math.PI / 180); // Slant back

        const endX = x + barbLen * Math.cos(angle);
        const endY = barbLen * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    // 3. Rain Graph (Bar chart)
    const rainSum = state.activeData.obs.rain;
    if (rainSum && rainSum.graph) {
        createGraphContainer('graph-rain', 'Precipitation', 'graphs-container', true);
        const rainData = rainSum.graph.map(p => ({ x: p[0] * 1000, y: p[1] }));

        charts.rain = new Chart(document.getElementById('graph-rain').getContext('2d'), {
            type: 'bar',
            data: {
                datasets: [{
                    label: 'Rain',
                    data: rainData,
                    backgroundColor: THEME.rainRate,
                    borderColor: THEME.rainRate,
                    borderWidth: 1
                }]
            },
            options: {
                ...getChartOptions(),
                scales: {
                    ...commonScales,
                    y: { beginAtZero: true }
                }
            }
        });
    } else {
        createNoDataContainer('Precipitation');
    }
}

function createNoDataContainer(title) {
    const section = els.graphs;
    const div = document.createElement('div');
    div.className = 'graph-card';
    div.style.gridColumn = "span 2";
    div.innerHTML = `
        <h3 class="card-label" style="margin-bottom:1rem">${title}</h3>
        <div style="height: 320px; width: 100%; display:flex; align-items:center; justify-content:center; background:#f8fafc; border-radius:8px; color:#64748b">
            <span>No Data Available</span>
        </div>
    `;
    section.appendChild(div);
}

function sampleData(data, minutes) {
    if (!data || data.length === 0) return [];
    const ms = minutes * 60 * 1000;
    const result = [];
    let lastTs = -Infinity;

    // Sort just in case
    data.sort((a, b) => a.x - b.x);

    data.forEach(p => {
        if (p.x - lastTs >= ms) {
            result.push(p);
            lastTs = p.x;
        }
    });
    return result;
}

function createGraphContainer(id, title, parentId, fullWidth = false) {
    const section = document.getElementById(parentId) || els.graphs;
    const div = document.createElement('div');
    div.className = 'graph-card';
    div.id = id + '-container';
    if (fullWidth) div.style.gridColumn = "span 2";
    div.innerHTML = `
        <h3 class="card-label" style="margin-bottom:1rem">${title}</h3>
        <div style="position: relative; height: 320px; width: 100%">
            <canvas id="${id}"></canvas>
        </div>
    `;
    section.appendChild(div);
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(15, 23, 42, 0.9)', // Slate 900
                titleColor: '#f8fafc',
                bodyColor: '#e2e8f0',
                titleFont: { family: 'Inter', size: 14, weight: '600' },
                bodyFont: { family: 'Inter', size: 13 },
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                usePointStyle: true,
                callbacks: {
                    title: (items) => {
                        if (!items.length) return '';
                        const d = new Date(items[0].parsed.x);
                        return d.toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                    }
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };
}

function setupNav() {
    els.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            els.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.view = btn.dataset.view;
            if (state.view === 'overview' || state.view === 'day') {
                els.dateDisplay.parentElement.style.opacity = '1';
                loadDate(state.currentDate);
            }
        });
    });
}

function setupDateControls() {
    els.datePrev.addEventListener('click', () => {
        state.currentDate.setDate(state.currentDate.getDate() - 1);
        loadDate(state.currentDate);
    });

    els.dateNext.addEventListener('click', () => {
        state.currentDate.setDate(state.currentDate.getDate() + 1);
        loadDate(state.currentDate);
    });
}

function setupUnits() {
    els.unitToggle.addEventListener('click', () => {
        alert("Unit switching in file-mode requires converted values implementation.");
    });
}

function hexToRgbA(hex, alpha) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return `rgba(0,0,0,${alpha})`;
}

function degToCompass(num) {
    const val = Math.floor((num / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[(val % 16)];
}

init();
