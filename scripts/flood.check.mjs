// Run: node scripts/flood.check.mjs
import assert from 'node:assert/strict';
import { floodStatus, hoursToDanger, FLOOD_WARNING_M, FLOOD_DANGER_M } from '../src/lib/flood.ts';

assert.equal(floodStatus(0.39), 'safe');
assert.equal(floodStatus(FLOOD_WARNING_M), 'warning');
assert.equal(floodStatus(FLOOD_DANGER_M), 'danger');
assert.equal(floodStatus(12), 'danger'); // metres are never re-guessed as cm

// 1.0 m rising 30 cm/h -> 60 cm to go -> 2 h
assert.ok(Math.abs(hoursToDanger(1.0, 30) - 2) < 1e-9);
assert.equal(hoursToDanger(1.0, 0), null);
assert.equal(hoursToDanger(1.0, -5), null);
assert.equal(hoursToDanger(FLOOD_DANGER_M, 30), null);
assert.equal(hoursToDanger(0, 1), null); // 160 h away: beyond the 48 h horizon

console.log('flood.check ok');
