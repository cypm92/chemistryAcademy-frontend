import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('guest requests are distinguished from calendar blocks by status', () => {
  const view = read('../src/views/ReservationsView.vue');
  assert.match(view, /calendarItemIsClass[\s\S]*?isCalendarClass\(calendarItem\.value\)/);
  assert.match(view, /isCalendarClass\(event\)/);
  assert.match(view, /calendarItem\.status === 'requested'[\s\S]*?decide\(calendarItem\.id, 'confirmed'\)/);
});
test('guest classes retain independent identities and admin controls without uploads', () => {
  const view = read('../src/views/ClassesView.vue');
  assert.match(view, /classPersonKey\(item\)/);
  assert.match(view, /<div v-if="isAdmin" class="class-actions">/);
  assert.match(view, /v-if="item\.user_id !== null && item\.status === 'confirmed'"\s+class="class-upload"/);
  assert.match(view, /v-else-if="item\.user_id !== null" class="attach-hint"/);
  for (const action of ['editClass(item)', 'cancelAdminClass(item)', 'setHistorical(item, !item.is_historical)']) {
    assert.ok(view.includes(`@click="${action}"`), `missing ${action}`);
  }
});

test('guest calendar classes expose the same management fields and controls', () => {
  const view = read('../src/views/ReservationsView.vue');
  const form = view.slice(view.indexOf('class="calendar-manage-card"'), view.indexOf('class="calendar-manage-card block-manage-card"'));
  assert.match(form, /<div class="calendar-manage-fields">/);
  assert.match(form, /<button type="button" class="danger" @click="cancelCalendarClass">/);
  assert.match(form, /<button class="primary">Guardar cambios<\/button>/);
});
test('class cards identify Madrid time beside the hour', () => {
  const view = read('../src/views/ClassesView.vue');
  assert.match(view, /class="class-date"[\s\S]*?toLocaleTimeString[\s\S]*?timeZone: MADRID[\s\S]*?Hora de Madrid[\s\S]*?class="class-main"/);
});
test('public booking hours carry a prominent Madrid time notice', () => {
  const view = read('../src/components/TrialBookingModal.vue');
  assert.match(view, /HORAS DISPONIBLES[\s\S]*?class="madrid-time-notice"[\s\S]*?Madrid/);
});
