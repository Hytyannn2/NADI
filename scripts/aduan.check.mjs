// Run: node scripts/aduan.check.mjs
import assert from 'node:assert/strict';
import { detectCategoryFromText as cat, detectUrgencyFromText as urg, detectEmergencyProtocol as emg } from '../src/lib/aduan.ts';

// Word-boundary matching: "hantar"/"sekitar" no longer hit a "tar" keyword
assert.equal(cat('tolong hantar orang tengok longkang tersumbat'), 'saliran');
assert.equal(cat('lampu jalan sekitar taman padam'), 'jalan'); // first category in CIVIC_CATEGORIES order wins ("jalan")
assert.equal(cat('lubangnya besar'), 'jalan'); // leading boundary only: suffixes still match
assert.equal(cat('keputusan mesyuarat'), 'lain'); // "keputusan" is not "putus" (lampu)

// "tapi" (but) is not "api" (fire)
assert.equal(urg('sampah banyak tapi tak diangkat'), 'Medium');
assert.equal(urg('tiang api terbakar'), 'High');

assert.equal(emg('ayah saya tak sedarkan diri')?.id, 'medical');
assert.equal(emg('pokok tumbang atas wayar elektrik')?.id, 'electrical');
assert.equal(emg('longkang tersumbat'), null);

console.log('aduan: ok');
