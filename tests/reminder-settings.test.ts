// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ReminderSettings from '../src/components/ReminderSettings.vue'
import { api } from '../src/services/api'
vi.mock('../src/services/api', () => ({ api: { get: vi.fn(), patch: vi.fn() }, errorMessage: () => 'Error de red' }))
afterEach(() => vi.clearAllMocks())
it('carga la configuración y cierra con Escape devolviendo el foco sin guardar', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { reminder_interval_minutes: 360 } })
  const w = mount(ReminderSettings, { attachTo: document.body }); const trigger = w.get('button'); (trigger.element as HTMLElement).focus()
  await trigger.trigger('click'); await flushPromises()
  expect((w.get('select').element as HTMLSelectElement).value).toBe('360')
  expect(document.activeElement?.textContent).toContain('Cerrar')
  await w.get('[role="dialog"]').trigger('keydown', { key: 'Escape' }); await flushPromises()
  expect(api.patch).not.toHaveBeenCalled(); expect(document.activeElement).toBe(trigger.element); w.unmount()
})
it('valida el intervalo personalizado y guarda mediante la API existente', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { reminder_interval_minutes: 1440 } })
  vi.mocked(api.patch).mockResolvedValue({ data: { reminder_interval_minutes: 525600 } })
  const w = mount(ReminderSettings); await w.get('button').trigger('click'); await flushPromises()
  await w.get('select').setValue('custom'); await w.get('input').setValue('525601'); await w.get('form').trigger('submit')
  expect(w.text()).toContain('entre 1 y 525600'); expect(api.patch).not.toHaveBeenCalled()
  await w.get('input').setValue('525600'); await w.get('form').trigger('submit'); await flushPromises()
  expect(api.patch).toHaveBeenCalledWith('/admin/notification-settings', { reminder_interval_minutes: 525600 })
  expect(w.text()).toContain('Configuración de alertas guardada'); w.unmount()
})
it('mantiene el foco dentro mientras se guarda incluso si se pierde', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { reminder_interval_minutes: 30 } })
  let finish!: (value: any) => void
  vi.mocked(api.patch).mockReturnValue(new Promise(resolve => { finish = resolve }))
  const w = mount(ReminderSettings, { attachTo: document.body })
  const trigger = w.get('button'); (trigger.element as HTMLElement).focus()
  await trigger.trigger('click'); await flushPromises()
  const dialog = w.get('[role="dialog"]'); const save = w.get('button[type="submit"]')
  ;(save.element as HTMLElement).focus()
  const descriptor = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, 'disabled')!
  const observed: boolean[] = []
  const spy = vi.spyOn(HTMLButtonElement.prototype, 'disabled', 'set').mockImplementation(function (this: HTMLButtonElement, value: boolean) {
    if (this === save.element && value) observed.push(document.activeElement === dialog.element)
    descriptor.set!.call(this, value)
  })
  await w.get('form').trigger('submit')
  expect(observed).toEqual([true])
  ;(document.activeElement as HTMLElement).blur()
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  document.body.dispatchEvent(tab)
  expect(tab.defaultPrevented).toBe(true); expect(document.activeElement).toBe(dialog.element)
  ;(document.activeElement as HTMLElement).blur()
  const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
  document.body.dispatchEvent(reverse)
  expect(reverse.defaultPrevented).toBe(true); expect(document.activeElement).toBe(dialog.element)
  await dialog.trigger('keydown', { key: 'Escape' }); await w.get('form').trigger('submit')
  expect(w.find('[role="dialog"]').exists()).toBe(true); expect(api.patch).toHaveBeenCalledTimes(1)
  spy.mockRestore(); finish({ data: { reminder_interval_minutes: 30 } }); await flushPromises()
  expect(document.activeElement).toBe(trigger.element); w.unmount()
})
it('muestra errores sin confirmar el guardado', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { reminder_interval_minutes: 30 } }); vi.mocked(api.patch).mockRejectedValue(new Error())
  const w = mount(ReminderSettings); await w.get('button').trigger('click'); await flushPromises(); await w.get('form').trigger('submit'); await flushPromises()
  expect(w.get('[role="alert"]').text()).toBe('Error de red'); expect(w.text()).not.toContain('guardada'); w.unmount()
})
