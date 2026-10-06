// Run: node scripts/format.check.mjs
import assert from 'node:assert/strict';
import { formatReportRelative as rel, formatReportExact, getDistanceKm, haversineKm } from '../src/lib/format.ts';

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

assert.equal(rel(undefined), '');
assert.equal(rel('not-a-date', true, 'Baru sahaja'), 'Baru sahaja');
assert.equal(rel(ago(10_000)), 'Baru sahaja');
assert.equal(rel(ago(10_000), false), 'Just now');
assert.equal(rel(ago(5 * MIN)), '5 minit lalu');
assert.equal(rel(ago(3 * HOUR), false), '3h ago');
assert.equal(rel(ago(2 * DAY)), '2 hari lalu');
assert.match(rel(ago(30 * DAY)), /\d{4}/); // falls through to a dated string
assert.equal(formatReportExact(''), '');

// Kota Bharu -> Kuala Krai, ~60 km
const raw = haversineKm(6.1254, 102.2381, 5.5306, 102.2014);
assert.ok(raw > 60 && raw < 70);
assert.equal(getDistanceKm(6.1254, 102.2381, 5.5306, 102.2014), Math.round(raw * 10) / 10);
assert.equal(getDistanceKm(6, 102, 6, 102), 0);

console.log('format: ok');
