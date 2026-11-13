// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MaterialTagPicker from '../src/components/MaterialTagPicker.vue'
// @ts-expect-error Node types are not part of the browser tsconfig.
import { readFileSync } from 'node:fs'

const remove = vi.hoisted(() => vi.fn())
vi.mock('../src/services/api', () => ({ api: { delete: remove }, errorMessage: (e: Error) => e.message }))

describe('eliminar etiqueta global', () => {
  it('no deja seleccionada una variante equivalente que recrearía la etiqueta borrada', async () => {
    remove.mockReset(); remove.mockResolvedValue({})
    const wrapper = mount(MaterialTagPicker, { props: { modelValue: ['QUIMICA'], pending: '', open: true, available: [{ id: 7, name: 'Quimica' }] } })
    await wrapper.get('button[aria-label="Eliminar etiqueta Quimica"]').trigger('click')
    await wrapper.get('[data-confirm-delete-tag]').trigger('click'); await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })
  it('rechaza el borrado si una selección equivalente no identifica una etiqueta entre varias', async () => {
    remove.mockReset(); remove.mockResolvedValue({})
    const wrapper = mount(MaterialTagPicker, { props: { modelValue: ['QUIMICA'], pending: '', open: true, available: [{ id: 7, name: 'Quimica' }, { id: 8, name: 'quimica' }] } })
    await wrapper.get('button[aria-label="Eliminar etiqueta Quimica"]').trigger('click')
    await wrapper.get('[data-confirm-delete-tag]').trigger('click'); await flushPromises()
    expect(remove).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('ambigua')
  })
  it('permite que el diálogo se encoja en pantallas estrechas', () => {
    const source = readFileSync('src/components/MaterialTagPicker.vue', 'utf8') as string
    expect(source).toMatch(/\.tag-delete-card\s*\{[^}]*min-width:\s*0/)
    expect(source).toMatch(/\.tag-delete-card\s*\{[^}]*max-width:\s*100%/)
  })
  it('permite cancelar y conserva el diálogo si falla la eliminación', async () => {
    remove.mockReset(); remove.mockRejectedValue(new Error('Error del servidor'))
    const wrapper = mount(MaterialTagPicker, { props: { modelValue: [], pending: '', open: true, available: [{ id: 7, name: 'QUÍMICA' }] } })
    await wrapper.get('button[aria-label="Eliminar etiqueta QUÍMICA"]').trigger('click')
    await wrapper.get('[role="dialog"] .secondary').trigger('click')
    expect(remove).not.toHaveBeenCalled()
    await wrapper.get('button[aria-label="Eliminar etiqueta QUÍMICA"]').trigger('click')
    await wrapper.get('[data-confirm-delete-tag]').trigger('click'); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Error del servidor')
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })
  it('pone el foco en cancelar y lo devuelve al cerrar con Escape', async () => {
    const wrapper = mount(MaterialTagPicker, { attachTo: document.body, props: { modelValue: [], pending: '', open: true, available: [{ id: 7, name: 'QUÍMICA' }] } })
    const button = wrapper.get('button[aria-label="Eliminar etiqueta QUÍMICA"]')
    ;(button.element as HTMLElement).focus()
    await button.trigger('click')
    expect((document.activeElement as HTMLElement).textContent).toContain('Cancelar')
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(document.activeElement).toBe(button.element)
    wrapper.unmount()
  })
  it('devuelve el foco al selector después de confirmar', async () => {
    remove.mockReset(); remove.mockResolvedValue({})
    const wrapper = mount(MaterialTagPicker, { attachTo: document.body, props: { modelValue: [], pending: '', open: true, available: [{ id: 7, name: 'QUÍMICA' }] } })
    await wrapper.get('button[aria-label="Eliminar etiqueta QUÍMICA"]').trigger('click')
    await wrapper.get('[data-confirm-delete-tag]').trigger('click'); await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Mostrar etiquetas existentes"]').element)
    wrapper.unmount()
  })
  it('permite eliminar también etiquetas ya seleccionadas', () => {
    const wrapper = mount(MaterialTagPicker, { props: { modelValue: ['QUÍMICA'], pending: '', open: true, available: [{ id: 7, name: 'QUÍMICA' }] } })
    expect(wrapper.find('button[aria-label="Eliminar etiqueta QUÍMICA"]').exists()).toBe(true)
  })
  it('pide confirmación antes de eliminar por ID', async () => {
    remove.mockReset(); remove.mockResolvedValue({})
    const wrapper = mount(MaterialTagPicker, { props: { modelValue: [], pending: '', open: true, available: [{ id: 7, name: 'QUÍMICA' }] } })
    await wrapper.get('button[aria-label="Eliminar etiqueta QUÍMICA"]').trigger('click')
    expect(remove).not.toHaveBeenCalled()
    expect(wrapper.get('[role="dialog"]').text()).toContain('QUÍMICA')
    await wrapper.get('[role="dialog"] button[data-confirm-delete-tag]').trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('/admin/tags/7')
    expect(wrapper.emitted('deleted')?.[0]).toEqual([{ id: 7, name: 'QUÍMICA' }])
  })
})
