import { els, state } from './state.js';
import { THEME, convertItem, hexToRgbA, sampleData, degToCompass, aggregate, resolveThemeColor, getAverage, interpolateColor } from './utils.js';

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
        rain: resolveThemeColor('--color-rain', '#2563eb', '#2563eb'),
        uv: resolveThemeColor('--color-uv', '#f43f5e', '#f43f5e')
    };

    // Determine Chart Type/Grouping based on View Scope
    const isDayView = (state.viewScope === 'day');

    // Scale Configuration
    const commonScales = {
        x: {
            type: 'time',
            grid: { display: false },
            ticks: {
                maxTicksLimit: 9,
                font: { weight: 'bold' },
                includeBounds: true,
                autoSkip: true
            }
        },
        y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            beginAtZero: false,
            grace: '5%' // Add some breathing room at top/bottom
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
        commonScales.x.max = eDate.getTime() - 1; // Subtract 1ms to end on Dec 31
        commonScales.x.time = { unit: 'month', displayFormats: { month: 'MMM' } };
    }

    // Force Edge-to-Edge
    commonScales.x.offset = false;
    commonScales.x.grid = { ...commonScales.x.grid, offset: false };

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
        let dataPoints = tempItem.graph.map(p => ({ x: p[0] * 1000, y: (p.length >= 3) ? p[2] : p[1] }));

        // Sampling for Mobile
        if (window.innerWidth < 640) {
            dataPoints = sampleData(dataPoints, 30);
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: `Temperature (${tempItem.unit})`,
                    data: dataPoints,
                    borderColor: chartTheme.outTemp,
                    backgroundColor: (ctx) => {
                        const canvas = ctx.chart.ctx;
                        const area = ctx.chart.chartArea;
                        if (!area) return 'transparent';
                        const gradient = canvas.createLinearGradient(0, area.bottom, 0, area.top);
                        const isImperial = state.units === 'imperial';
                        const stops = [
                            { t: isImperial ? 20 : -10, c: '#3b82f6' },
                            { t: isImperial ? 45 : 7, c: '#06b6d4' },
                            { t: isImperial ? 70 : 21, c: '#10b981' },
                            { t: isImperial ? 90 : 32, c: '#f59e0b' },
                            { t: isImperial ? 110 : 43, c: '#ef4444' }
                        ];
                        stops.forEach(s => {
                            const yPos = ctx.chart.scales.y.getPixelForValue(s.t);
                            const pct = 1 - (yPos - area.top) / (area.bottom - area.top);
                            if (pct >= 0 && pct <= 1) gradient.addColorStop(pct, hexToRgbA(s.c, 0.4));
                        });
                        return gradient;
                    },
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    hitRadius: 10
                }]
            },
            options: { ...getChartOptions(isDayView), scales: commonScales }
        });
        charts.temp = chart;
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
        let dataPoints = windSpeed.graph.map(p => ({ x: p[0] * 1000, y: (p.length >= 3) ? p[2] : p[1] }));

        // Sampling for Mobile
        if (window.innerWidth < 640) {
            dataPoints = sampleData(dataPoints, 30);
        }

        const opts = getChartOptions(true);
        opts.scales = commonScales;
        opts.plugins.tooltip.callbacks.label = (ctx) => {
            return `Wind Speed: ${ctx.parsed.y.toFixed(1)} ${windSpeed.unit}`;
        };

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
            options: opts
        });

    } else {
        // Aggregate Wind (Max Gust and Avg)
        const aggData = aggregate(windSpeed.graph, state.viewScope);

        // We can show two datasets: Max (Bar) and Avg (Line)
        const maxData = aggData.map(d => ({ x: d.x, y: d.max }));
        const avgData = aggData.map(d => ({ x: d.x, y: d.avg }));

        const windOpts = getChartOptions(false);
        windOpts.scales = commonScales;
        windOpts.plugins.tooltip.callbacks.label = (ctx) => {
            let label = ctx.dataset.label || '';
            if (label) label += ': ';
            if (ctx.parsed.y !== null) {
                label += ctx.parsed.y.toFixed(1);
                label += ` ${windSpeed.unit}`;
            }
            return label;
        };

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
            options: windOpts
        });
    }
}

function renderRainChart(commonScales, isDayView, chartTheme) {
    const rainSum = convertItem(state.activeData.obs.rain, state.units);
    const rainRate = convertItem(state.activeData.obs.rainRate, state.units);

    if ((!rainSum || !rainSum.graph) && (!rainRate || !rainRate.graph)) {
        createNoDataContainer('Precipitation');
        return;
    }

    createGraphContainer('graph-rain', 'Precipitation', 'graphs-container', true);
    const ctx = document.getElementById('graph-rain').getContext('2d');

    let datasets = [];

    // Prepare Options with Tooltip Formatting
    const options = getChartOptions(isDayView);
    options.scales = {
        ...commonScales,
        y: {
            beginAtZero: true,
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.05)' },
            title: {
                display: true,
                text: `Precipitation (${rainSum.unit})`
            }
        }
    };

    // Add Tooltip Callback for Rain (2 decimals)
    options.plugins.tooltip.callbacks.label = (context) => {
        let label = context.dataset.label || '';
        if (label) label += ': ';
        if (context.parsed.y !== null) {
            label += context.parsed.y.toFixed(2);
        }
        return label;
    };

    if (isDayView) {
        // Use rainRate for Day View if available
        const rainAmountData = rainSum.graph.map(p => ({ x: p[0] * 1000, y: (p.length >= 3) ? p[2] : p[1] }));

        // 1. Bar Dataset for Rain Amount
        datasets.push({
            type: 'bar',
            label: `Rainfall (${rainSum.unit})`,
            data: rainAmountData,
            backgroundColor: chartTheme.rain,
            borderColor: chartTheme.rain,
            borderWidth: 1,
            yAxisID: 'y'
        });

        // 2. Line Dataset for Cumulative Precip (Total)
        if (rainSum && rainSum.graph) {
            let runningTotal = 0;
            const cumulativeData = rainAmountData.map(d => {
                if (d.y !== null && !isNaN(d.y)) {
                    runningTotal += d.y;
                }
                return { x: d.x, y: runningTotal };
            });

            datasets.push({
                type: 'line',
                label: `Cumulative (${rainSum.unit})`,
                data: cumulativeData,
                borderColor: '#0891b2', // Cyan-700
                backgroundColor: hexToRgbA('#0891b2', 0.1),
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true,
                yAxisID: 'y1'
            });

            // Configure Secondary Axis for Total
            options.scales.y1 = {
                beginAtZero: true,
                position: 'right',
                grid: { display: false },
                title: {
                    display: true,
                    text: `Total (${rainSum.unit})`
                }
            };
        }
    } else {
        // For History Views (Week/Month/Year), Bars for daily totals still make sense
        const aggData = aggregate(rainSum.graph, state.viewScope);
        const chartData = aggData.map(d => ({ x: d.x, y: d.sum }));

        // Update Y axis title for history
        options.scales.y.title.text = `Precip Total (${rainSum.unit})`;

        // 1. Bar Dataset (Daily/Weekly Sums)
        datasets.push({
            type: 'bar',
            label: `Precip Total (${rainSum.unit})`,
            data: chartData,
            backgroundColor: chartTheme.rain,
            borderColor: chartTheme.rain,
            borderWidth: 1,
            yAxisID: 'y'
        });
    }

    charts.rain = new Chart(ctx, {
        type: 'bar',
        data: { datasets },
        options: options
    });
}


export function drawDial(canvas, min, max, current, rangeMin, rangeMax, unit, color, title, textPrimary, textSecondary) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    // ABSOLUTE CENTER TEXT STRATEGY
    // We want the text to be at h * 0.5 (Dead Center)
    // In this function, text is drawn at: cy - radius * 0.3 + (10 * s)
    // So: h * 0.5 = cy - radius * 0.3 + (10 * s)
    // cy = (h * 0.5) + (radius * 0.3) - (10 * s)

    // Relative Sizing Factors (Base: 280px width)
    const s = Math.max(w / 280, 1.0);
    const radius = Math.min(w, h) * 0.38;

    const textY = h * 0.5;
    const cy = textY + (radius * 0.3) - (10 * s);

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
    ctx.lineWidth = 15 * s;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Active Range
    const rangeStart = getAngle(rangeMin);
    const rangeEnd = getAngle(rangeMax);

    if (Math.abs(rangeEnd - rangeStart) > 0.01) {
        if (title === 'Temperature') {
            // Temperature-aware multi-color arc
            const isImp = state.units === 'imperial';
            // Scale and colors
            const stops = [
                { t: isImp ? 20 : -10, c: '#3b82f6' },
                { t: isImp ? 45 : 7, c: '#06b6d4' },
                { t: isImp ? 70 : 21, c: '#10b981' },
                { t: isImp ? 90 : 32, c: '#f59e0b' },
                { t: isImp ? 110 : 43, c: '#ef4444' }
            ];

            const getTempColor = (temp) => {
                if (temp <= stops[0].t) return stops[0].c;
                if (temp >= stops[stops.length - 1].t) return stops[stops.length - 1].c;
                for (let i = 0; i < stops.length - 1; i++) {
                    if (temp >= stops[i].t && temp <= stops[i + 1].t) {
                        const pct = (temp - stops[i].t) / (stops[i + 1].t - stops[i].t);
                        return interpolateColor(stops[i].c, stops[i + 1].c, pct);
                    }
                }
                return color;
            };

            // Draw arc in segments for smooth color transition
            const segments = 60; // Higher segments for smoother gradient
            const step = (rangeEnd - rangeStart) / segments;
            const tempStep = (rangeMax - rangeMin) / segments;

            for (let i = 0; i < segments; i++) {
                const sAngle = rangeStart + i * step;
                const eAngle = sAngle + step + 0.01; // Overlap slightly to prevent gaps
                const currentTemp = rangeMin + i * tempStep;

                ctx.beginPath();
                ctx.arc(cx, cy, radius, sAngle, eAngle);
                ctx.lineWidth = 15 * s;
                ctx.strokeStyle = getTempColor(currentTemp);
                ctx.lineCap = i === 0 || i === segments - 1 ? 'round' : 'butt';
                ctx.stroke();
            }
        } else {
            ctx.beginPath();
            const sAngle = Math.min(rangeStart, rangeEnd);
            const eAngle = Math.max(rangeStart, rangeEnd);
            ctx.arc(cx, cy, radius, sAngle, eAngle);
            ctx.lineWidth = 15 * s;
            ctx.strokeStyle = color + '66';
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    // 3. Indicator
    if (current !== null && current !== undefined) {
        const currentAngle = getAngle(current);
        const px = cx + radius * Math.cos(currentAngle);
        const py = cy + radius * Math.sin(currentAngle);

        ctx.beginPath();
        ctx.arc(px, py, 12 * s, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 4 * s;
        ctx.strokeStyle = (title === 'Temperature') ? '#f59e0b' : color;
        ctx.stroke();
    }

    // 4. Text
    ctx.textAlign = 'center';

    const tPrimary = textPrimary || '#1e293b';
    const tSecondary = textSecondary || '#64748b';

    // Value
    ctx.font = `bold ${56 * s}px Inter, sans-serif`;
    ctx.fillStyle = color;
    const valStr = (current !== null && current !== undefined) ? (+current).toFixed(1) : '--';
    ctx.fillText(valStr, cx, cy - radius * 0.3 + (10 * s));

    // Unit
    ctx.font = `500 ${22 * s}px Inter, sans-serif`;
    ctx.fillStyle = tSecondary;
    ctx.fillText(unit, cx, cy - radius * 0.3 + (40 * s));

    // L/H Labels (Split for stability)
    ctx.font = `500 ${18 * s}px Inter, sans-serif`;
    ctx.fillStyle = tSecondary;

    // Low
    ctx.textAlign = 'right';
    ctx.fillText('L: ', cx - (60 * s), cy + (30 * s));
    ctx.textAlign = 'left';
    ctx.fillText((+rangeMin).toFixed(1), cx - (60 * s), cy + (30 * s));

    // High
    ctx.textAlign = 'right';
    ctx.fillText('H: ', cx + (50 * s), cy + (30 * s));
    ctx.textAlign = 'left';
    ctx.fillText((+rangeMax).toFixed(1), cx + (50 * s), cy + (30 * s));
}

// Internal Helpers
function createGraphContainer(id, title, parentId, fullWidth = false) {
    const section = document.getElementById(parentId) || els.graphs;
    const div = document.createElement('div');
    div.className = 'graph-card';
    div.id = id + '-container';

    // On mobile, everything is full width. On desktop, honor fullWidth
    if (fullWidth || window.innerWidth < 640) {
        div.style.gridColumn = "span 2";
    }

    div.innerHTML = `
        <h3 class="card-label" style="margin-bottom:1rem">${title}</h3>
        <div class="chart-responsive-wrapper" style="position: relative; width: 100%; min-height: 250px;">
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
    // Shifted down to align values with other cards

    const s = Math.max(w / 280, 1.0);
    const radius = Math.min(w, h) * 0.38;

    // ABSOLUTE CENTER TEXT STRATEGY
    const cy = h * 0.5;

    const t = theme || {};
    const colTickC = t.tickCardinal || '#94a3b8';
    const colTickM = t.tickMajor || '#cbd5e1';
    const colTickm = t.tickMinor || '#e2e8f0';
    const colArrow = t.arrow || '#64748b';

    ctx.clearRect(0, 0, w, h);

    // 1. Tick Marks (Compass Rose)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 2 * s;
    // Denser ticks: every 2 degrees
    for (let i = 0; i < 360; i += 2) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 180);

        ctx.beginPath();
        if (i % 90 === 0) {
            // Cardinal (N/E/S/W)
            ctx.strokeStyle = colTickC;
            ctx.lineWidth = 2.5 * s;
            ctx.moveTo(0, -radius + (4 * s));
            ctx.lineTo(0, -radius - (10 * s)); // Longer cardinal ticks
        } else if (i % 30 === 0) {
            // Major
            ctx.strokeStyle = colTickM;
            ctx.lineWidth = 2 * s;
            ctx.moveTo(0, -radius + (2 * s));
            ctx.lineTo(0, -radius - (8 * s));
        } else if (i % 10 === 0) {
            // Minor - Darkened to match major ticks better
            ctx.strokeStyle = colTickM;
            ctx.lineWidth = 1.5 * s;
            ctx.moveTo(0, -radius);
            ctx.lineTo(0, -radius - (5 * s));
        } else {
            // Micro (every 2 degrees)
            ctx.strokeStyle = colTickm;
            ctx.globalAlpha = 0.3; // Very subtle
            ctx.lineWidth = 1 * s;
            ctx.moveTo(0, -radius);
            ctx.lineTo(0, -radius - (3 * s));
        }
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();

    // N/E/S/W Labels (Inside to prevent clipping)
    ctx.font = `bold ${18 * s}px Inter, sans-serif`;
    ctx.fillStyle = textSecondary || '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Position labels just inside the ticks
    const labelDist = radius - (16 * s);

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
        ctx.moveTo(markerDist - (2 * s), 0);
        ctx.lineTo(markerDist + (10 * s), 6 * s);
        ctx.lineTo(markerDist + (10 * s), -6 * s);
        ctx.closePath();

        ctx.fillStyle = colArrow;
        ctx.fill();
        ctx.restore();
    }

    // 3. Center Text (Speed)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Speed Value: Draw at dead center
    ctx.font = `bold ${56 * s}px Inter, sans-serif`;
    ctx.fillStyle = textPrimary || '#1e293b';
    ctx.textAlign = 'center';
    ctx.fillText((+speed).toFixed(1), cx, cy);

    // Unit: Relative to center
    ctx.font = `500 ${19 * s}px Inter, sans-serif`;
    ctx.fillStyle = textSecondary || '#64748b';
    ctx.fillText(unit, cx, cy + (30 * s));

    // 4. Gust
    if (gust !== null && gust !== undefined) {
        ctx.font = `500 ${17 * s}px Inter, sans-serif`;
        ctx.fillStyle = color; // Accent color
        ctx.fillText(`Gust: ${(+gust).toFixed(1)}`, cx, cy + (55 * s));
    }
}

export function drawGauge(canvas, min, max, current, unit, color, title, textPrimary, textSecondary) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;

    // Relative Sizing Factors (Base: 280px width)
    const s = Math.max(w / 280, 1.0);
    const radius = Math.min(w, h) * 0.38;

    // ABSOLUTE CENTER TEXT STRATEGY
    const cy = h * 0.5;

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

    for (let i = 0; i <= numTicks; i++) {
        const val = min + step * i;
        const angle = getAngle(val);

        const isMajor = (i % 5 === 0);
        const tickLen = isMajor ? (12 * s) : (8 * s);
        const tickWidth = isMajor ? (2.5 * s) : (1.5 * s);

        const x1 = cx + radius * Math.cos(angle);
        const y1 = cy + radius * Math.sin(angle);
        const x2 = cx + (radius - tickLen) * Math.cos(angle);
        const y2 = cy + (radius - tickLen) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = tickWidth;
        // Darkened minor ticks
        ctx.strokeStyle = isMajor ? color : '#cbd5e1';
        ctx.stroke();
    }

    // 2. Active Arc (Progress)
    const currentAngle = getAngle(current !== null ? current : min);
    ctx.beginPath();
    ctx.arc(cx, cy, radius - (15 * s), startAngle, currentAngle);
    ctx.lineWidth = 6 * s;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 3. Value Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold ${56 * s}px Inter, sans-serif`;
    ctx.fillStyle = textPrimary || '#1e293b';
    const valStr = (current !== null && current !== undefined) ? (+current).toFixed(1) : '--';

    // Centered at cy
    ctx.fillText(valStr, cx, cy);

    // 4. Unit
    ctx.font = `500 ${22 * s}px Inter, sans-serif`;
    ctx.fillStyle = textSecondary || '#64748b';
    ctx.fillText(unit, cx, cy + (30 * s));

    // 5. Min/Max Labels
    ctx.font = `500 ${14 * s}px Inter, sans-serif`;
    ctx.fillStyle = textSecondary || '#64748b';

    // Position nicely around the bottom opening
    const rLabel = radius + (20 * s);
    const minX = cx + rLabel * Math.cos(startAngle);
    const minY = cy + rLabel * Math.sin(startAngle);
    const maxX = cx + rLabel * Math.cos(endAngle);
    const maxY = cy + rLabel * Math.sin(endAngle);

    ctx.textAlign = 'center';
    ctx.fillText((+min).toFixed(0), minX, minY);
    ctx.fillText((+max).toFixed(0), maxX, maxY);
}
