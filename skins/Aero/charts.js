// charts.js
import { els, state } from './state.js';
import { THEME, convertItem, hexToRgbA, sampleData, degToCompass, aggregate } from './utils.js';

let charts = {};

export function renderGraphs() {
    els.graphs.innerHTML = '';
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    if (!state.activeData) return;

    // Determine Chart Type/Grouping based on View Scope
    const isDayView = (state.viewScope === 'day');

    // Scale Configuration
    const commonScales = {
        x: {
            type: 'time',
            grid: { display: false },
            ticks: { maxTicksLimit: 9, font: { weight: 'bold' } }
        },
        y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            beginAtZero: false
        }
    };

    // Configure X-Axis unit/format
    const sDate = new Date(state.currentDate);
    if (isDayView) {
        sDate.setHours(0, 0, 0, 0);
        commonScales.x.min = sDate.getTime();
        commonScales.x.max = sDate.getTime() + 24 * 60 * 60 * 1000;
        commonScales.x.time = { unit: 'hour', displayFormats: { hour: 'h a' } };
    } else if (state.viewScope === 'week') {
         // Week View: X-axis days
         commonScales.x.time = { unit: 'day', displayFormats: { day: 'EEE d' } };
         // Auto range based on data
    } else if (state.viewScope === 'month') {
        sDate.setDate(1); sDate.setHours(0,0,0,0);
        commonScales.x.min = sDate.getTime();
        const eDate = new Date(sDate);
        eDate.setMonth(eDate.getMonth() + 1);
        commonScales.x.max = eDate.getTime();
        commonScales.x.time = { unit: 'day', displayFormats: { day: 'd' } };
    } else if (state.viewScope === 'year') {
        sDate.setMonth(0, 1); sDate.setHours(0,0,0,0);
        commonScales.x.min = sDate.getTime();
        const eDate = new Date(sDate);
        eDate.setFullYear(eDate.getFullYear() + 1);
        commonScales.x.max = eDate.getTime();
        commonScales.x.time = { unit: 'month', displayFormats: { month: 'MMM' } };
    }

    // 1. Temperature Chart
    renderTempChart(commonScales, isDayView);

    // 2. Wind Chart
    renderWindChart(commonScales, isDayView);

    // 3. Rain Chart
    renderRainChart(commonScales, isDayView);
}

function renderTempChart(commonScales, isDayView) {
    const tempItem = convertItem(state.activeData.obs.outTemp, state.units);
    if (!tempItem || !tempItem.graph) {
        createNoDataContainer('Temperature');
        return;
    }

    createGraphContainer('graph-temp', 'Temperature', 'graphs-container', true);
    const ctx = document.getElementById('graph-temp').getContext('2d');

    if (isDayView) {
        // Line Chart for Day
        const dataPoints = tempItem.graph.map(p => ({ x: p[0] * 1000, y: p[1] }));
        charts.temp = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: `Temperature (${tempItem.unit})`,
                    data: dataPoints,
                    borderColor: THEME.outTemp,
                    backgroundColor: hexToRgbA(THEME.outTemp, 0.1),
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    hitRadius: 10
                }]
            },
            options: { ...getChartOptions(isDayView), scales: commonScales }
        });
    } else {
        // Floating Bar Chart (Min/Max) for History
        const aggData = aggregate(tempItem.graph, state.viewScope);

        // Data format for floating bar: [min, max]
        const dataPoints = aggData.map(d => ({
            x: d.x,
            y: [d.min, d.max],
            avg: d.avg // Store avg for tooltip
        }));

        const avgDataPoints = aggData.map(d => ({ x: d.x, y: d.avg }));

        charts.temp = new Chart(ctx, {
            type: 'bar',
            data: {
                datasets: [
                    {
                        label: `Temperature Range (${tempItem.unit})`,
                        data: dataPoints,
                        backgroundColor: THEME.outTemp,
                        borderColor: THEME.outTemp,
                        borderRadius: 4,
                        barThickness: 'flex',
                        maxBarThickness: 30,
                        order: 2
                    },
                    {
                        label: `Average Temp (${tempItem.unit})`,
                        data: avgDataPoints,
                        type: 'line',
                        borderColor: '#ea580c', // Darker orange
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.3,
                        order: 1,
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    return `Avg: ${ctx.parsed.y.toFixed(1)} ${tempItem.unit}`;
                                }
                            }
                        }
                    }
                ]
            },
            options: {
                ...getChartOptions(false),
                scales: commonScales,
                plugins: {
                    ...getChartOptions(false).plugins,
                    tooltip: {
                        ...getChartOptions(false).plugins.tooltip,
                        callbacks: {
                            ...getChartOptions(false).plugins.tooltip.callbacks,
                            label: (ctx) => {
                                const raw = ctx.raw;
                                // If it's the average line
                                if (ctx.dataset.type === 'line') {
                                     return `Avg: ${ctx.parsed.y.toFixed(1)} ${tempItem.unit}`;
                                }
                                // raw.y is [min, max]
                                const min = raw.y[0].toFixed(1);
                                const max = raw.y[1].toFixed(1);
                                const avg = raw.avg ? raw.avg.toFixed(1) : '-';
                                return `High: ${max} | Low: ${min} | Avg: ${avg} ${tempItem.unit}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

function renderWindChart(commonScales, isDayView) {
    const windSpeed = convertItem(state.activeData.obs.windSpeed, state.units);
    const windDir = state.activeData.obs.windDir;

    // Wind requires both speed and direction for scatter, or just speed for aggregate
    if (!windSpeed || !windSpeed.graph) {
        createNoDataContainer('Wind');
        return;
    }

    createGraphContainer('graph-wind', isDayView ? 'Wind' : 'Wind (Max/Avg)', 'graphs-container', true);
    const ctx = document.getElementById('graph-wind').getContext('2d');

    if (isDayView && windDir && windDir.graph) {
        // Scatter with Barbs
        const dirMap = new Map(windDir.graph.map(p => [p[0], p[1]]));
        let vectorData = windSpeed.graph.map(p => {
            const ts = p[0];
            const speed = p[1];
            const dir = dirMap.get(ts);
            if (dir === undefined || dir === null) return null;
            return {
                x: ts * 1000,
                y: 0,
                speed: speed,
                dir: dir,
                unit: windSpeed.unit
            };
        }).filter(x => x !== null);

        vectorData = sampleData(vectorData, 60);

        charts.wind = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Wind',
                    data: vectorData,
                    borderColor: THEME.windSpeed,
                    backgroundColor: THEME.windSpeed,
                    pointRadius: 4
                }]
            },
            options: {
                ...getChartOptions(true),
                scales: {
                    x: commonScales.x,
                    y: { display: false, min: -40, max: 40 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const p = ctx.raw;
                                const compass = degToCompass(p.dir);
                                return `Wind: ${p.speed.toFixed(1)} ${p.unit || ''} (${compass})`;
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
                        drawWindBarb(ctx, point.x, point.y, raw.speed, raw.dir);
                    });
                    ctx.restore();
                }
            }]
        });

    } else {
        // Aggregate Wind (Max Gust and Avg)
        const aggData = aggregate(windSpeed.graph, state.viewScope);

        // We can show two datasets: Max (Bar) and Avg (Line)
        const maxData = aggData.map(d => ({ x: d.x, y: d.max }));
        const avgData = aggData.map(d => ({ x: d.x, y: d.avg }));

        charts.wind = new Chart(ctx, {
            type: 'bar',
            data: {
                datasets: [
                    {
                        label: 'Max Gust',
                        data: maxData,
                        backgroundColor: THEME.windSpeed,
                        order: 2
                    },
                    {
                        label: 'Avg Speed',
                        data: avgData,
                        type: 'line',
                        borderColor: '#064e3b', // darker green
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.3,
                        order: 1
                    }
                ]
            },
            options: {
                ...getChartOptions(false),
                scales: commonScales
            }
        });
    }
}

function renderRainChart(commonScales, isDayView) {
    const rainSum = convertItem(state.activeData.obs.rain, state.units);
    if (!rainSum || !rainSum.graph) {
        createNoDataContainer('Precipitation');
        return;
    }

    createGraphContainer('graph-rain', 'Precipitation', 'graphs-container', true);
    const ctx = document.getElementById('graph-rain').getContext('2d');

    let chartData;
    if (isDayView) {
        chartData = rainSum.graph.map(p => ({ x: p[0] * 1000, y: p[1] }));
    } else {
        const aggData = aggregate(rainSum.graph, state.viewScope);
        chartData = aggData.map(d => ({ x: d.x, y: d.sum }));
    }

    charts.rain = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [{
                label: `Rain (${rainSum.unit})`,
                data: chartData,
                backgroundColor: THEME.rainRate,
                borderColor: THEME.rainRate,
                borderWidth: 1
            }]
        },
        options: {
            ...getChartOptions(isDayView),
            scales: {
                ...commonScales,
                y: { beginAtZero: true }
            }
        }
    });
}


export function drawDial(canvas, min, max, current, rangeMin, rangeMax, unit, color, title) {
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
        // Ensure accurate arc drawing
        // If rangeStart > rangeEnd (shouldn't happen with correct min/max logic but safety check)
        const s = Math.min(rangeStart, rangeEnd);
        const e = Math.max(rangeStart, rangeEnd);

        ctx.arc(cx, cy, radius, s, e);
        ctx.lineWidth = 15;

        let strokeStyle = color + '66';

        if (title === 'Temperature') {
            const grad = ctx.createLinearGradient(0, h, w, h);
            grad.addColorStop(0, '#1e3a8a');
            grad.addColorStop(0.2, '#3b82f6');
            grad.addColorStop(0.4, '#06b6d4');
            grad.addColorStop(0.6, '#10b981');
            grad.addColorStop(0.8, '#f97316');
            grad.addColorStop(1, '#ef4444');
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
    ctx.strokeStyle = (title === 'Temperature') ? '#f59e0b' : color;
    ctx.stroke();

    // 4. Text
    ctx.textAlign = 'center';

    const isDark = document.documentElement.classList.contains('dark');
    const textPrimary = isDark ? '#f8fafc' : '#1e293b';
    const textSecondary = isDark ? '#94a3b8' : '#64748b';

    // Value
    ctx.font = 'bold 36px Inter, sans-serif';
    // Use the theme text color if it's temperature, or if it's dark mode and we want high contrast
    if (title === 'Temperature') {
        ctx.fillStyle = textPrimary;
    } else {
        ctx.fillStyle = color;
    }

    ctx.fillText((+current).toFixed(1), cx, cy - radius * 0.3);

    // Unit
    ctx.font = '500 14px Inter, sans-serif';
    ctx.fillStyle = textSecondary;
    ctx.fillText(unit, cx, cy - radius * 0.3 + 20);

    // L/H
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = textSecondary;
    ctx.fillText(`L: ${(+rangeMin).toFixed(1)}`, cx - 50, cy + 20);
    ctx.fillText(`H: ${(+rangeMax).toFixed(1)}`, cx + 50, cy + 20);
}

// Internal Helpers
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

function getChartOptions(isDayView) {
    const opts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
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

                        // Different Date format for Month/Year tooltip vs Day
                        if (!isDayView) {
                             return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        }

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
    return opts;
}

function drawWindBarb(ctx, x, y, speed, dir) {
    ctx.save();
    ctx.translate(x, y);
    const rad = (dir - 90) * (Math.PI / 180);
    ctx.rotate(rad);

    const length = 25;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();

    let pos = length;
    let speedRem = Math.round(speed / 5) * 5;

    while (speedRem >= 50) {
        drawPennant(ctx, pos);
        pos -= 10;
        speedRem -= 50;
    }

    while (speedRem >= 10) {
        drawBarbLine(ctx, pos, 10);
        pos -= 7;
        speedRem -= 10;
    }

    if (speedRem >= 5) {
        drawBarbLine(ctx, pos, 5);
    }

    ctx.restore();
}

function drawPennant(ctx, x) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 6, -10);
    ctx.lineTo(x - 12, 0);
    ctx.fill();
}

function drawBarbLine(ctx, x, type) {
    const barbLen = (type === 10) ? 14 : 7;
    const angle = -120 * (Math.PI / 180);

    const endX = x + barbLen * Math.cos(angle);
    const endY = barbLen * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(endX, endY);
    ctx.stroke();
}
