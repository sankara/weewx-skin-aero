// utils.test.js
import { describe, it, expect } from 'vitest';
import { convertItem, getAverage, degToCompass } from '../utils.js';

describe('utils.js', () => {
    describe('convertItem', () => {
        // Define granular state objects for testing
        const imperialState = {
            temp: '°F',
            speed: 'mph',
            pressure: 'inHg',
            rain: 'in',
            rainRate: 'in/h'
        };

        const metricState = {
            temp: '°C',
            speed: 'km/h',
            pressure: 'hPa',
            rain: 'mm',
            rainRate: 'mm/h'
        };

        it('should convert Celsius to Fahrenheit', () => {
            const item = { unit: '°C', current: 0, min: -10, max: 10 };
            const converted = convertItem(item, imperialState);
            expect(converted.unit).toBe('°F');
            expect(converted.current).toBe(32);
            expect(converted.min).toBe(14);
            expect(converted.max).toBe(50);
        });

        it('should convert Fahrenheit to Celsius', () => {
            const item = { unit: '°F', current: 32 };
            const converted = convertItem(item, metricState);
            expect(converted.unit).toBe('°C');
            expect(converted.current).toBe(0);
        });

        it('should convert mph to km/h', () => {
            const item = { unit: 'mph', current: 10 };
            const converted = convertItem(item, metricState);
            expect(converted.unit).toBe('km/h');
            expect(converted.current).toBeCloseTo(16.09, 1);
        });

        it('should handle null values gracefully', () => {
            const item = { unit: '°C', current: null, min: undefined };
            const converted = convertItem(item, imperialState);
            expect(converted.current).toBeNull();
            expect(converted.min).toBeUndefined();
        });

        it('should convert graph data points', () => {
            const item = {
                unit: '°C',
                graph: [
                    [1000, 0],
                    [2000, 10, 20] // [start, end, val]
                ]
            };
            const converted = convertItem(item, imperialState);
            expect(converted.graph[1][2]).toBe(68);
        });

        it('should convert rain rate (cm/hr to in/h)', () => {
            const item = { unit: 'cm/hr', current: 2.54 };
            const converted = convertItem(item, imperialState);
            expect(converted.unit).toBe('in/h');
            expect(converted.current).toBe(1);
        });

        it('should convert rain rate (mm/h to in/h)', () => {
            const item = { unit: 'mm/h', current: 25.4 };
            const converted = convertItem(item, imperialState);
            expect(converted.unit).toBe('in/h');
            expect(converted.current).toBe(1);
        });

        it('should respect mixed units (Granular)', () => {
            const mixedState = {
                temp: '°C',
                speed: 'mph', // Mixed!
                pressure: 'inHg'
            };

            // Speed should convert to mph if it was km/h
            const speedItem = { unit: 'km/h', current: 16.0934 };
            const convSpeed = convertItem(speedItem, mixedState);
            expect(convSpeed.unit).toBe('mph');
            expect(convSpeed.current).toBeCloseTo(10, 1);

            // Temp should stay C if it was C
            const tempItem = { unit: '°C', current: 20 };
            const convTemp = convertItem(tempItem, mixedState);
            expect(convTemp.unit).toBe('°C');
            expect(convTemp.current).toBe(20);
        });
    });

    describe('getAverage', () => {
        it('should return .avg if present', () => {
            expect(getAverage({ avg: 10, current: 5 })).toBe(10);
        });

        it('should calculate average from sum and count', () => {
            expect(getAverage({ sum: 30, count: 3 })).toBe(10);
        });

        it('should calculate average from graph data', () => {
            const item = {
                graph: [[0, 10], [0, 20], [0, null]]
            };
            expect(getAverage(item)).toBe(15);
        });

        it('should fallback to (min+max)/2', () => {
            expect(getAverage({ min: 10, max: 20 })).toBe(15);
        });

        it('should fallback to .current', () => {
            expect(getAverage({ current: 10 })).toBe(10);
        });
    });

    describe('degToCompass', () => {
        it('should convert degrees to cardinal directions', () => {
            expect(degToCompass(0)).toBe('N');
            expect(degToCompass(90)).toBe('E');
            expect(degToCompass(180)).toBe('S');
            expect(degToCompass(270)).toBe('W');
            expect(degToCompass(350)).toBe('N');
        });

        it('should handle null/undefined', () => {
            expect(degToCompass(null)).toBe('--');
            expect(degToCompass(undefined)).toBe('--');
        });
    });
});
