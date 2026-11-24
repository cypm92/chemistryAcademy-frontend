import { test } from "node:test";
import { strict as assert } from "node:assert";
import { madridToUtc, madridInput, utcApiTimestamp, normalizeBookingTimes, isBookingEndpoint, shiftCalendarPeriod, classEndsByMadridCutoff } from "../src/services/madridTime.ts";

test("booking requests and query-string endpoints receive UTC normalization", () => {
  assert.equal(isBookingEndpoint('/admin/booking-requests'), true);
  assert.equal(isBookingEndpoint('/classes?historical=true'), true);
  assert.equal(isBookingEndpoint('/admin/users'), false);
});

test("month and year navigation clamps the day instead of skipping a period", () => {
  const january = shiftCalendarPeriod(new Date(2026, 0, 31, 12), 'month', 1);
  assert.deepEqual([january.getFullYear(), january.getMonth(), january.getDate()], [2026, 1, 28]);
  const leap = shiftCalendarPeriod(new Date(2024, 1, 29, 12), 'year', 1);
  assert.deepEqual([leap.getFullYear(), leap.getMonth(), leap.getDate()], [2025, 1, 28]);
});
test("Madrid winter and summer convert independently of browser zone", () => {
  assert.equal(madridToUtc("2026-01-15T10:30"), "2026-01-15T09:30:00.000Z");
  assert.equal(madridToUtc("2026-07-15T10:30"), "2026-07-15T08:30:00.000Z");
  assert.equal(madridInput("2026-01-15T23:30:00Z"), "2026-01-16T00:30");
});
test("rejects nonexistent and ambiguous Madrid times", () => {
  assert.throws(() => madridToUtc("2026-03-29T02:30"), /no existe/);
  assert.throws(() => madridToUtc("2026-10-25T02:30"), /ambigua/);
});

test("public booking without timezone still blocks the correct Madrid slot", () => {
  const [booking] = normalizeBookingTimes([{ starts_at: '2026-07-15T08:30:00', ends_at: '2026-07-15T09:30:00' }]);
  const start = new Date(madridToUtc('2026-07-15T10:30'));
  const end = new Date(start.getTime() + 3600000);
  assert.ok(new Date(booking!.starts_at) < end && new Date(booking!.ends_at) > start);
});

test("backend naive UTC timestamps are never interpreted as browser local time", () => {
  assert.equal(utcApiTimestamp("2026-01-15T09:30:00"), "2026-01-15T09:30:00Z");
  assert.equal(utcApiTimestamp("2026-01-15T09:30:00+00:00"), "2026-01-15T09:30:00+00:00");
});

// Direct coverage of the Madrid 22:00 cutoff used by both createAdminClass and saveCalendarClass
// (editing a class already asserted this rejection through the form; the admin "create" form filters
// its end-time options so it never reaches the rejection branch through the UI, so the pure function
// is exercised directly here with the same start/duration shape the admin create form computes).
test("a class ending exactly at 22:00 Madrid time passes the cutoff", () => {
  const starts = new Date(madridToUtc("2026-01-15T21:30"));
  assert.equal(classEndsByMadridCutoff(starts, 1), true); // 21:30 + 30min = 22:00
});
test("a class ending after 22:00 Madrid time on the same day fails the cutoff", () => {
  const starts = new Date(madridToUtc("2026-01-15T21:30"));
  assert.equal(classEndsByMadridCutoff(starts, 2), false); // 21:30 + 1h = 22:30
  assert.equal(classEndsByMadridCutoff(starts, 4), false); // 21:30 + 2h = 23:30
});
test("a class ending on the following Madrid calendar day fails the cutoff", () => {
  const starts = new Date(madridToUtc("2026-01-15T23:30"));
  assert.equal(classEndsByMadridCutoff(starts, 2), false); // 23:30 + 1h -> 00:30 next day
});
