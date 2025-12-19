// charts.js
import { els, state } from './state.js';
import { THEME, convertItem, hexToRgbA, sampleData, degToCompass, aggregate, resolveThemeColor } from './utils.js';

let charts = {};

export function renderGraphs() {
    els.graphs.innerHTML = '';
    Object.values(charts).forEach(c => c.destroy());
    charts = {};

    if (!state.activeData) return;

    // Resolve Theme Colors for Charts (needed for Alpha/Fill)
    const CHART_THEME = {
        outTemp: resolveThemeColor('--color-temp', '#f59e0b', '#fbbf24'),
        humidity: resolveThemeColor('--color-humidity', '#0ea5e9', '#0ea5e9'),
        windSpeed: resolveThemeColor('--color-wind', '#10b981', '#10b981'),
        pressure: resolveThemeColor('--color-pressure', '#8b5cf6', '#8b5cf6'),
        rainRate: resolveThemeColor('--color-rain', '#2563eb', '#2563eb'),
        uv: resolveThemeColor('--color-uv', '#f43f5e', '#f43f5e')
    };

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
    const now = state.currentDate || new Date();
    const sDate = new Date(now);
    sDate.setMilliseconds(0);
    sDate.setSeconds(0);
    sDate.setMinutes(0);
    sDate.setHours(0);

    if (isDayView) {
        commonScales.x.min = sDate.getTime();
        commonScales.x.max = sDate.getTime() + 24 * 60 * 60 * 1000;
        commonScales.x.time = { unit: 'hour', displayFormats: { hour: 'h a' } };
    } else if (state.viewScope === 'week') {
        // Week View: full Mon-Sun or Sun-Sat range?
        // WeeWX usually considers week-to-date from the start of the week.
        // Let's force a consistent 7-day view.
        // If state.activeData has start/end, use that to align the grid.
        let startTime = sDate.getTime();
        let endTime = sDate.getTime() + 7 * 24 * 60 * 60 * 1000;

        if (state.activeData && state.activeData.meta && state.activeData.meta.startTimestamp) {
            startTime = state.activeData.meta.startTimestamp * 1000;
            endTime = state.activeData.meta.endTimestamp * 1000;
        } else {
            // Fallback: Start of week (assuming Monday start for consistency with many weewx setups, or just use 7 days back)
            const day = sDate.getDay();
            const diff = sDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            sDate.setDate(diff);
            startTime = sDate.getTime();
            endTime = startTime + 7 * 24 * 60 * 60 * 1000;
        }

        commonScales.x.min = startTime;
        commonScales.x.max = endTime - 1; // Subtract 1ms to avoid 8th day label
        commonScales.x.time = { unit: 'day', displayFormats: { day: 'EEE d' } };

    } else if (state.viewScope === 'month') {
        sDate.setDate(1);
        commonScales.x.min = sDate.getTime();
        const eDate = new Date(sDate);
        eDate.setMonth(eDate.getMonth() + 1);
        commonScales.x.max = eDate.getTime();
        commonScales.x.time = { unit: 'day', displayFormats: { day: 'd' } };
    } else if (state.viewScope === 'year') {
        sDate.setMonth(0, 1);
        commonScales.x.min = sDate.getTime();
        const eDate = new Date(sDate);
        eDate.setFullYear(eDate.getFullYear() + 1);
        commonScales.x.max = eDate.getTime();
        commonScales.x.time = { unit: 'month', displayFormats: { month: 'MMM' } };
    }

    // Server Truth Override: Only override if it BROADENS the view or provides specific bounds
    // But we strictly want consistent axes as per user request: "consistent x-axis - day (12am to 12am), week (start to end of week), month (1st to last day of month), year (jan to dec)"
    // So if it's "to-date" data, we still want to show the full period.
    // The meta.startTimestamp and endTimestamp from Weewx for 'SummaryBy...' usually match the period exactly.
    if (state.activeData && state.activeData.meta && state.activeData.meta.startTimestamp && state.activeData.meta.endTimestamp) {
        // Only override if we aren't already enforcing a full period, or if it aligns.
        // For 'week', we already used it. For day/month/year, our JS calculation is usually more "strict" to the calendar.
        // Let's trust the Server for week since Weewx knows its own week configuration (Sunday vs Monday start).
        if (state.viewScope === 'week') {
            commonScales.x.min = state.activeData.meta.startTimestamp * 1000;
            // End exactly at the last second of the 7th day
            commonScales.x.max = state.activeData.meta.endTimestamp * 1000 - 1000;

            // Enforce 7 labels
            commonScales.x.ticks = {
                ...commonScales.x.ticks,
                maxTicksLimit: 7,
                autoSkip: false
            };
        }
    }

    // 1. Temperature Chart
    renderTempChart(commonScales, isDayView, CHART_THEME);

    // 2. Wind Chart
    renderWindChart(commonScales, isDayView, CHART_THEME);

    // 3. Rain Chart
    renderRainChart(commonScales, isDayView, CHART_THEME);
}

function renderTempChart(commonScales, isDayView, chartTheme) {
    const tempItem = convertItem(state.activeData.obs.outTemp, state.units);
    if (!tempItem || !tempItem.graph) {
        createNoDataContainer('Temperature');
        return;
    }

    createGraphContainer('graph-temp', 'Temperature', 'graphs-container', true);
    const ctx = document.getElementById('graph-temp').getContext('2d');

    if (isDayView) {
        // Line Chart for Day
        const dataPoints = tempItem.graph.map(p => ({ x: p[0] * 1000, y: (p.length >= 3) ? p[2] : p[1] }));
        charts.temp = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: `Temperature (${tempItem.unit})`,
                    data: dataPoints,
                    borderColor: chartTheme.outTemp,
                    backgroundColor: hexToRgbA(chartTheme.outTemp, 0.1),
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
                        backgroundColor: chartTheme.outTemp,
                        borderColor: chartTheme.outTemp,
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

function renderWindChart(commonScales, isDayView, chartTheme) {
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
        const dirMap = new Map(windDir.graph.map(p => [p[0], (p.length >= 3) ? p[2] : p[1]]));
        let vectorData = windSpeed.graph.map(p => {
            const ts = p[0];
            const speed = (p.length >= 3) ? p[2] : p[1];
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
                    borderColor: chartTheme.windSpeed,
                    backgroundColor: chartTheme.windSpeed,
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
                    ctx.strokeStyle = chartTheme.windSpeed;
                    ctx.fillStyle = chartTheme.windSpeed;
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

    } else if (isDayView) {
        // Fallback: Day View but NO Wind Direction -> Simple Line Chart for Speed
        const dataPoints = windSpeed.graph.map(p => ({ x: p[0] * 1000, y: (p.length >= 3) ? p[2] : p[1] }));

        charts.wind = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: `Wind Speed (${windSpeed.unit})`,
                    data: dataPoints,
                    borderColor: chartTheme.windSpeed,
                    backgroundColor: hexToRgbA(chartTheme.windSpeed, 0.2),
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    hitRadius: 10
                }]
            },
            options: { ...getChartOptions(true), scales: commonScales }
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
                        backgroundColor: chartTheme.windSpeed,
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

function renderRainChart(commonScales, isDayView, chartTheme) {
    const rainSum = convertItem(state.activeData.obs.rain, state.units);
    if (!rainSum || !rainSum.graph) {
        createNoDataContainer('Precipitation');
        return;
    }

    createGraphContainer('graph-rain', 'Precipitation', 'graphs-container', true);
    const ctx = document.getElementById('graph-rain').getContext('2d');

    let chartData;
    if (isDayView) {
        chartData = rainSum.graph.map(p => ({ x: p[0] * 1000, y: (p.length >= 3) ? p[2] : p[1] }));
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
                backgroundColor: chartTheme.rainRate,
                borderColor: chartTheme.rainRate,
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


export function drawDial(canvas, min, max, current, rangeMin, rangeMax, unit, color, title, textPrimary, textSecondary) {
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
            // Gradient based on typical temperature range colors
            // 0% (Left/Start) -> 100% (Right/End) of the *Canvas Width*? 
            // The arc goes from bottom-left to bottom-right.
            // Horizontal gradient works best.
            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0.1, '#3b82f6'); // Blue (Cold)
            grad.addColorStop(0.3, '#06b6d4'); // Cyan
            grad.addColorStop(0.5, '#10b981'); // Green (Comfort)
            grad.addColorStop(0.7, '#f59e0b'); // Orange
            grad.addColorStop(0.9, '#ef4444'); // Red (Hot)
            strokeStyle = grad;
        }

        ctx.strokeStyle = strokeStyle;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // 3. Indicator
    // Only draw needle if we have a valid number
    if (current !== null && current !== undefined) {
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
    }

    // 4. Text
    ctx.textAlign = 'center';

    // Default fallbacks if arguments are missing (e.g. initial render before update)
    const tPrimary = textPrimary || '#1e293b';
    const tSecondary = textSecondary || '#64748b';

    // Value
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillStyle = color;
    // Check if it's temperature for specific contrast needs, but we don't have title here if passed null
    // Actually ui.js passes null for title now.
    // If color is not provided we fallback.

    const valStr = (current !== null && current !== undefined) ? (+current).toFixed(1) : '--';
    ctx.fillText(valStr, cx, cy - radius * 0.3);

    // Unit
    ctx.font = '500 14px Inter, sans-serif';
    ctx.fillStyle = tSecondary;
    ctx.fillText(unit, cx, cy - radius * 0.3 + 20);

    // L/H Labels (Split for stability)
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = tSecondary;

    // Low
    // Label fixed, Value grows right
    ctx.textAlign = 'right';
    ctx.fillText('L: ', cx - 45, cy + 20);
    ctx.textAlign = 'left';
    ctx.fillText((+rangeMin).toFixed(1), cx - 45, cy + 20);

    // High
    // Label fixed, Value grows right
    ctx.textAlign = 'right';
    ctx.fillText('H: ', cx + 35, cy + 20);
    ctx.textAlign = 'left';
    ctx.fillText((+rangeMax).toFixed(1), cx + 35, cy + 20);
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

export function drawCompass(canvas, speed, gust, direction, unit, color, title, textPrimary, textSecondary, theme) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    // Keep cy at 0.55 to roughly align center with Gauge (though gauge CoG is higher)
    const cy = h * 0.55;
    // Slightly smaller radius to ensure labels inside don't cramp, also safer bounds
    const radius = Math.min(w, h) * 0.40;

    const t = theme || {};
    const colTickC = t.tickCardinal || '#94a3b8';
    const colTickM = t.tickMajor || '#cbd5e1';
    const colTickm = t.tickMinor || '#e2e8f0';
    const colArrow = t.arrow || '#64748b';

    ctx.clearRect(0, 0, w, h);

    // 1. Tick Marks (Compass Rose)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 2;
    // Denser ticks: every 2 degrees
    for (let i = 0; i < 360; i += 2) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 180);

        ctx.beginPath();
        if (i % 90 === 0) {
            // Cardinal (N/E/S/W)
            ctx.strokeStyle = colTickC;
            ctx.lineWidth = 2.5;
            ctx.moveTo(0, -radius + 4);
            ctx.lineTo(0, -radius - 10); // Longer cardinal ticks
        } else if (i % 30 === 0) {
            // Major
            ctx.strokeStyle = colTickM;
            ctx.lineWidth = 2;
            ctx.moveTo(0, -radius + 2);
            ctx.lineTo(0, -radius - 8);
        } else if (i % 10 === 0) {
            // Minor
            ctx.strokeStyle = colTickm;
            ctx.lineWidth = 1.5;
            ctx.moveTo(0, -radius);
            ctx.lineTo(0, -radius - 5);
        } else {
            // Micro (every 2 degrees)
            ctx.strokeStyle = colTickm;
            ctx.globalAlpha = 0.3; // Very subtle
            ctx.lineWidth = 1;
            ctx.moveTo(0, -radius);
            ctx.lineTo(0, -radius - 3);
        }
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();

    // N/E/S/W Labels (Inside to prevent clipping)
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = textSecondary || '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Position labels just inside the ticks (radius is ~64, so -16 puts it ~48 from center)
    const labelDist = radius - 16;

    ctx.fillText('N', cx, cy - labelDist);
    ctx.fillText('S', cx, cy + labelDist);
    ctx.fillText('E', cx + labelDist, cy);
    ctx.fillText('W', cx - labelDist, cy);

    // 2. Direction Arrow
    if (direction !== null && direction !== undefined) {
        const angle = direction - 90;
        const rad = angle * (Math.PI / 180);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rad);

        const markerDist = radius;

        ctx.beginPath();
        ctx.moveTo(markerDist - 2, 0);
        ctx.lineTo(markerDist + 10, 6);
        ctx.lineTo(markerDist + 10, -6);
        ctx.closePath();

        ctx.fillStyle = colArrow;
        ctx.fill();
        ctx.restore();
    }

    // 3. Center Text (Speed)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Speed Value (Move up slightly to make room for Gust below)
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillStyle = textPrimary || '#1e293b';
    ctx.fillText((+speed).toFixed(1), cx, cy - 5);

    // Unit
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = textSecondary || '#64748b';
    ctx.fillText(unit, cx, cy + 18);

    // 4. Gust
    if (gust !== null && gust !== undefined) {
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillStyle = color; // Accent color
        ctx.fillText(`Gust: ${(+gust).toFixed(1)}`, cx, cy + 32);
    }
}

export function drawGauge(canvas, min, max, current, unit, color, title, textPrimary, textSecondary) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * 0.55; // Lower slightly
    const radius = Math.min(w, h) * 0.42;

    ctx.clearRect(0, 0, w, h);

    // Full Circle Gauge: 135deg to 405deg (270deg total sweep)
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;

    const angleRange = endAngle - startAngle;

    const getAngle = (val) => {
        const pct = (val - min) / (max - min);
        const clamped = Math.max(0, Math.min(1, pct));
        return startAngle + clamped * angleRange;
    };

    // 1. Ticks
    const numTicks = 30;
    const step = (max - min) / numTicks;

    ctx.save();
    ctx.translate(cx, cy);

    for (let i = 0; i <= numTicks; i++) {
        const val = min + (i * step);
        const ang = getAngle(val);

        ctx.save();
        ctx.rotate(ang);

        // Tick style
        const isMajor = i % 5 === 0;

        ctx.beginPath();
        if (isMajor) {
            ctx.strokeStyle = textSecondary; // Darker
            ctx.lineWidth = 2;
            ctx.moveTo(radius, 0);
            ctx.lineTo(radius - 12, 0); // Long tick
        } else {
            ctx.strokeStyle = hexToRgbA(textSecondary, 0.7); // Much more visible
            ctx.lineWidth = 1;
            ctx.moveTo(radius, 0);
            ctx.lineTo(radius - 6, 0); // Short tick
        }
        ctx.stroke();

        // Labels for Major Ticks
        if (isMajor) {
            ctx.translate(radius - 22, 0);
            ctx.rotate(-ang); // Undo rotate for text
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.fillStyle = textSecondary;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw label
            let labelText = val.toFixed(0);
            if (max - min < 10) labelText = val.toFixed(1);
            if (max - min < 2) labelText = val.toFixed(2);

            ctx.fillText(labelText, 0, 0);
        }

        ctx.restore();
    }
    ctx.restore();

    // 2. Active Arc / Background
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 25, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgbA(color, 0.05); // Very subtle fill
    ctx.fill();

    // 3. Current Needle
    if (current !== null && current !== undefined) {
        const currentAngle = getAngle(current);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(currentAngle);

        // Needle Line
        ctx.beginPath();
        ctx.moveTo(-10, 0); // Rear extension
        ctx.lineTo(radius - 5, 0); // Tip
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ef4444'; // Red needle
        ctx.lineCap = 'round';
        ctx.stroke();

        // Center Pivot
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.restore();
    }

    // 4. Labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title REMOVED (Handled by HTML)

    // Value (Large, Bottom)
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillStyle = textPrimary;
    const valStr = (current !== null) ? (+current).toFixed(2) : '--';
    ctx.fillText(valStr, cx, cy + radius + 25);

    // Unit (Next to value)
    ctx.font = '500 14px Inter, sans-serif';
    ctx.fillStyle = textSecondary;
    const valWidth = ctx.measureText(valStr).width;
    ctx.fillText(unit, cx + valWidth / 2 + 15, cy + radius + 28);
}
