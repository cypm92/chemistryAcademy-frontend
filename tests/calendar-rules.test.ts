import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import * as rules from '../src/services/madridTime.ts';

test('calendar weeks start Monday and month grid follows the same alignment', () => {
  assert.equal(rules.mondayStart(new Date(2026, 10, 1, 12)).getDate(), 26);
  assert.equal(rules.mondayStart(new Date(2026, 10, 2, 12)).getDate(), 2);
});
test('weekends cannot be booked by students or guests', () => {
  assert.equal(rules.isWeekend(new Date(2026, 10, 1, 12)), true);
  assert.equal(rules.isWeekend(new Date(2026, 9, 31, 12)), true);
  assert.equal(rules.isWeekend(new Date(2026, 10, 2, 12)), false);
});
test('requested can be cancelled any time, confirmed strictly more than 24 hours', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  assert.equal(rules.canCancelBooking('requested', '2026-11-01T12:00:00Z', now), true);
  assert.equal(rules.canCancelBooking('confirmed', '2026-11-03T12:00:00Z', now), false);
  assert.equal(rules.canCancelBooking('confirmed', '2026-11-03T12:00:00.001Z', now), true);
  assert.equal(rules.canCancelBooking('cancelled', '2026-11-05T12:00:00Z', now), false);
});
test('booking screens connect rules and display clear notices', () => {
  const reservations = readFileSync(new URL('../src/views/ReservationsView.vue', import.meta.url), 'utf8');
  const trial = readFileSync(new URL('../src/components/TrialBookingModal.vue', import.meta.url), 'utf8');
  const classes = readFileSync(new URL('../src/views/ClassesView.vue', import.meta.url), 'utf8');
  assert.match(reservations, /class="madrid-time-notice calendar-time-notice"/);
  assert.equal((reservations.match(/weekend: isWeekend\(day\)/g) || []).length, 2);
  assert.match(reservations, /isWeekend\(selectedDate\.value\)/);
  assert.match(trial, /isWeekend\(selectedDate\.value\)/);
  assert.match(classes, /canCancelBooking\(/);
  assert.match(reservations, /24 horas o menos/);
  assert.match(classes, /24 horas o menos/);
});
