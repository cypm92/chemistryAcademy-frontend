// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StudentMaterialsModal from '../src/components/StudentMaterialsModal.vue'
import { permissionMutationPending, permissionTimeoutToast } from '../src/services/permissionTimeoutToast'
const calls = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('../src/services/api', async (importOriginal) => ({ ...await importOriginal<typeof import('../src/services/api')>(), api: calls }))
beforeEach(() => {
  vi.restoreAllMocks()
  permissionTimeoutToast.value = ''
  permissionMutationPending.value = false
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
it('agrupa por etiqueta y retira la concesión del alumno elegido', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const rows = [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct: null, tags: [{ id: 2, name: 'QUIMICA' }] }, { material: { id: 8, title: 'Clase', filename: 'v.mp4', kind: 'video' }, direct: null, tags: [{ id: 2, name: 'QUIMICA' }] }]
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/material-access') ? rows : url.endsWith('/tag-grants') ? [{ id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }] : url === '/admin/tags' ? [{ id: 2, name: 'QUIMICA' }] : [] }))
  calls.delete.mockResolvedValue({})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: QUIMICA')
  expect(wrapper.text()).toContain('Archivo (PDF)')
  expect(wrapper.text()).toContain('Clase (VIDEO)')
  expect(wrapper.get('button[aria-label="Retirar etiqueta QUIMICA"]').text()).toBe('Eliminar')
  await wrapper.get('button[aria-label="Retirar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  expect(calls.delete).toHaveBeenCalledWith('/admin/users/3/tag-grants/2', { timeout: 30000 })
  wrapper.unmount()
})
it('busca materiales y comparte el material elegido con su tipo visible', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/materials' ? [{ id: 8, title: 'Átomos', kind: 'pdf' }, { id: 9, title: 'Enlace', kind: 'video' }] : [] }))
  calls.post.mockResolvedValue({})
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('[aria-label="Elegir material"]').trigger('click')
  expect(wrapper.text()).toContain('Átomos (PDF)')
  expect(wrapper.text()).toContain('Enlace (VIDEO)')
  await wrapper.get('[aria-label="Buscar material"]').setValue('enlace')
  expect(wrapper.find('[aria-label="Seleccionar Átomos (PDF)"]').exists()).toBe(false)
  await wrapper.get('[aria-label="Seleccionar Enlace (VIDEO)"]').trigger('click')
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledWith('/admin/grants', expect.objectContaining({ material_id: 9 }), { timeout: 30000 })
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('Selecciona un material')
  wrapper.unmount()
})
it('no vuelve a seleccionar un archivo concedido al reintentar la carga', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  let fail = false
  calls.get.mockImplementation((url: string) => fail && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, code: 'ERR_NETWORK' }) : Promise.resolve({ data: url === '/admin/materials' ? [{ id: 9, title: 'Enlace', kind: 'pdf' }] : [] }))
  calls.post.mockReset().mockImplementation(() => { fail = true; return Promise.resolve({}) })
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  fail = false; await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('Selecciona un material')
  wrapper.unmount()
})


it('no envía un material que desaparece durante una recarga', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  let reloadFails = false, materialRemoved = false
  calls.get.mockImplementation((url: string) => reloadFails && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, code: 'ERR_NETWORK' }) : Promise.resolve({ data: url === '/admin/materials' ? (materialRemoved ? [{ id: 10, title: 'Otro', kind: 'pdf' }] : [{ id: 9, title: 'Enlace', kind: 'pdf' }]) : url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockImplementation(() => { reloadFails = true; return Promise.resolve({}) })
  calls.post.mockReset()
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  reloadFails = false; materialRemoved = true
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.get('[aria-label="Elegir material"]').text()).toContain('Selecciona un material')
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('Selecciona un material')
  wrapper.unmount()
})

it('no concede acceso si no hay materiales y ofrece cerrar el buscador', async () => {
  calls.post.mockReset()
  calls.get.mockResolvedValue({ data: [] })
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const wrapper = mount(StudentMaterialsModal, { props: { student }, attachTo: document.body }); await flushPromises()
  await wrapper.get('[aria-label="Elegir material"]').trigger('click')
  expect(wrapper.text()).toContain('No hay materiales disponibles.')
  await wrapper.get('[aria-label="Buscar material"]').trigger('keydown', { key: 'Escape' })
  expect(wrapper.find('[aria-label="Buscar material"]').exists()).toBe(false)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).toContain('Selecciona un material.')
  expect(wrapper.find('[role="alert"] button').exists()).toBe(false)
  expect(calls.post).not.toHaveBeenCalled()
  wrapper.unmount()
})
it('permite cambiar fecha y hora y permiso de descarga del acceso directo', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const rows = [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct: { id: 5, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }, tags: [] }]
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/material-access') ? rows : [] }))
  calls.patch.mockResolvedValue({})
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  const input = wrapper.get('input[aria-label="Caducidad de Archivo"]')
  expect(input.attributes('type')).toBe('datetime-local')
  expect(wrapper.find('button[aria-label="Abrir calendario de Archivo"]').exists()).toBe(true)
  const showPicker = vi.fn()
  Object.defineProperty(input.element, 'showPicker', { value: showPicker })
  const typing = new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true })
  input.element.dispatchEvent(typing)
  expect(typing.defaultPrevented).toBe(true)
  await wrapper.get('button[aria-label="Abrir calendario de Archivo"]').trigger('click')
  expect(showPicker).toHaveBeenCalledOnce()
  await input.setValue('2032-06-15T13:45')
  await wrapper.get('.student-grant-row input[type="checkbox"]').setValue(true)
  expect(wrapper.get('.student-grant-row').text()).toContain('Permitir descarga')
  await wrapper.get('.student-grant-row .primary').trigger('click'); await flushPromises()
  expect(calls.patch).toHaveBeenCalledWith('/admin/grants/5', { expires_at: new Date('2032-06-15T13:45').toISOString(), can_download: true }, { timeout: 30000 })
  expect(wrapper.get('button[aria-label="Retirar acceso directo a Archivo"]').text()).toBe('Eliminar')
  wrapper.unmount()
})

it('no conserva el aviso de éxito cuando un cambio posterior tiene fecha inválida', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const rows = [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct: { id: 5, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }, tags: [] }]
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/material-access') ? rows : [] }))
  calls.patch.mockReset().mockResolvedValue({})
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.save-direct').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Acceso directo actualizado')
  await wrapper.get('input[aria-label="Caducidad de Archivo"]').setValue('')
  await wrapper.get('.save-direct').trigger('click')
  expect(wrapper.text()).toContain('Selecciona una fecha válida')
  expect(wrapper.text()).not.toContain('Acceso directo actualizado')
  wrapper.unmount()
})

it('no reenvía etiquetas ya concedidas al pulsar de nuevo guardar', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }]
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/tags' ? tags : [] }))
  calls.post.mockReset().mockResolvedValue({})
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access select').setValue('tag')
  for (const checkbox of wrapper.findAll('fieldset input[type="checkbox"]')) await checkbox.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(2)
  expect(wrapper.findAll('fieldset input[type="checkbox"]').every(input => !(input.element as HTMLInputElement).checked)).toBe(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})

it('edita caducidad y descarga de una concesión de etiqueta y confirma su alcance', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockReset().mockResolvedValue({})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: QUIMICA')
  const input = wrapper.get('input[aria-label="Caducidad de etiqueta QUIMICA"]')
  const expectedDate = new Date(grant.expires_at)
  expect((input.element as HTMLInputElement).value).toBe(new Date(expectedDate.getTime() - expectedDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 16))
  await input.setValue('2032-06-15T13:45')
  await wrapper.get('input[aria-label="Permitir descarga por etiqueta QUIMICA"]').setValue(true)
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('todos los archivos'))
  expect(calls.patch).toHaveBeenCalledWith('/admin/users/3/tag-grants/2', { grant_id: 11, expires_at: new Date('2032-06-15T13:45').toISOString(), can_download: true }, { timeout: 30000 })
  wrapper.unmount()
})

it('permite reintentar la carga fallida de concesiones sin mostrar datos obsoletos', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  let fail = true
  calls.get.mockImplementation((url: string) => url.endsWith('/tag-grants') && fail ? Promise.reject(new Error('fallo')) : Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('Sin concesiones por etiqueta')
  fail = false
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: QUIMICA')
  wrapper.unmount()
})

it('permite reintentar una lectura inicial sin bloquear globalmente los permisos', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  let fail = true
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => fail && url === '/admin/tags' ? Promise.reject({ isAxiosError: true, code: 'ERR_NETWORK' }) : Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  expect(permissionTimeoutToast.value).toBe('')
  expect(wrapper.get('[role="alert"] button').text()).toContain('Reintentar')
  expect(wrapper.text()).not.toContain('Etiqueta: QUIMICA')
  fail = false; await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: QUIMICA')
  wrapper.unmount()
})

it('restaura la descarga directa si la fecha inválida impide guardar', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  permissionTimeoutToast.value = ''
  const rows = [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct: { id: 5, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }, tags: [] }]
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/material-access') ? rows : [] }))
  calls.patch.mockReset()
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  const checkbox = wrapper.get('.student-grant-row input[type="checkbox"]')
  await checkbox.setValue(true)
  await wrapper.get('input[aria-label="Caducidad de Archivo"]').setValue('')
  await wrapper.get('.student-grant-row .save-direct').trigger('click')
  expect(calls.patch).not.toHaveBeenCalled()
  expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  expect(rows[0]!.direct.can_download).toBe(false)
  wrapper.unmount()
})

it('descarta cambios de descarga y caducidad al cancelar la confirmación de etiqueta', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockReset().mockResolvedValue({})
  vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  const date = wrapper.get('input[aria-label="Caducidad de etiqueta QUIMICA"]')
  const initialDate = (date.element as HTMLInputElement).value
  const checkbox = wrapper.get('input[aria-label="Permitir descarga por etiqueta QUIMICA"]')
  await date.setValue('2032-06-15T13:45')
  await checkbox.setValue(true)
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click')
  expect(calls.patch).not.toHaveBeenCalled()
  expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  expect((date.element as HTMLInputElement).value).toBe(initialDate)
  await date.setValue('2033-06-15T13:45')
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  expect(calls.patch).toHaveBeenCalledWith('/admin/users/3/tag-grants/2', expect.objectContaining({ can_download: false, expires_at: new Date('2033-06-15T13:45').toISOString() }), { timeout: 30000 })
  wrapper.unmount()
})

it('mantiene el foco dentro del diálogo y excluye controles de secciones cerradas', async () => {
  calls.get.mockResolvedValue({ data: [] })
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const wrapper = mount(StudentMaterialsModal, { props: { student }, attachTo: document.body }); await flushPromises()
  const close = wrapper.get('button[aria-label="Cerrar materiales"]')
  const summary = wrapper.get('.add-access > summary')
  ;(close.element as HTMLElement).focus()
  await close.trigger('keydown', { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(summary.element)
  await summary.trigger('keydown', { key: 'Tab' })
  expect(document.activeElement).toBe(close.element)
  wrapper.unmount()
})

it('conserva el foco en el diálogo mientras se recargan los permisos tras guardar', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  let loadingAgain = false
  let finish!: (value: { data: unknown[] }) => void
  calls.get.mockImplementation((url: string) => {
    if (loadingAgain && url.endsWith('/material-access')) return new Promise(resolve => { finish = resolve })
    return Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] })
  })
  calls.patch.mockResolvedValue({})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student }, attachTo: document.body }); await flushPromises()
  const save = wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]')
  ;(save.element as HTMLElement).focus()
  loadingAgain = true
  await save.trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Cargando materiales')
  expect(document.activeElement).toBe(wrapper.get('button[aria-label="Cerrar materiales"]').element)
  finish({ data: [] }); await flushPromises()
  wrapper.unmount()
})

it('mantiene el foco en el diálogo durante un guardado pendiente y tras un error', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  let reject!: (reason: unknown) => void
  calls.patch.mockImplementation(() => new Promise((_, fail) => { reject = fail }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student }, attachTo: document.body }); await flushPromises()
  const save = wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]')
  ;(save.element as HTMLElement).focus()
  await save.trigger('click')
  expect(document.activeElement).toBe(wrapper.get('button[aria-label="Cerrar materiales"]').element)
  reject({ isAxiosError: true, response: { data: { detail: 'fallo al guardar' } } }); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('fallo al guardar')
  expect(document.activeElement).toBe(wrapper.get('button[aria-label="Cerrar materiales"]').element)
  wrapper.unmount()
})

it('libera el bloqueo si el componente se desmonta de forma inesperada', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  let finish!: (value: object) => void
  calls.patch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student }, attachTo: document.body }); await flushPromises()
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click')
  expect(permissionMutationPending.value).toBe(true)
  wrapper.unmount()
  finish({}); await flushPromises()
  expect(permissionMutationPending.value).toBe(false)
})

it('avisa del cambio aunque falle la recarga tras guardar', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  let fail = false
  calls.get.mockImplementation((url: string) => fail && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, response: { data: { detail: 'fallo de recarga' } } }) : Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockResolvedValue({})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  fail = true
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  expect(wrapper.emitted('changed')).toHaveLength(1)
  expect(wrapper.text()).toContain('Acceso por etiqueta actualizado')
  expect(wrapper.get('[role="alert"]').text()).toContain('fallo de recarga')
  wrapper.unmount()
})

it('permite reintentar una lectura que falla después de guardar correctamente', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  let fail = false
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => fail && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, code: 'ERR_NETWORK' }) : Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockReset().mockResolvedValue({})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  fail = true; await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  expect(calls.patch).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('Acceso por etiqueta actualizado')
  expect(permissionTimeoutToast.value).toBe('')
  expect(wrapper.get('[role="alert"]').text()).toContain('No se pudieron recargar los accesos')
  expect(wrapper.get('[role="alert"]').text()).not.toContain('No se pudo completar la operación')
  expect(wrapper.text()).not.toContain('Etiqueta: QUIMICA')
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('No se pudieron cargar los accesos')
  expect(wrapper.text()).toContain('Acceso por etiqueta actualizado')
  expect(calls.patch).toHaveBeenCalledTimes(1)
  fail = false; await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: QUIMICA')
  expect(calls.patch).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

it('restaura el permiso de etiqueta cuando la fecha es inválida', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockReset()
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  const checkbox = wrapper.get('input[aria-label="Permitir descarga por etiqueta QUIMICA"]')
  await checkbox.setValue(true)
  await wrapper.get('input[aria-label="Caducidad de etiqueta QUIMICA"]').setValue('')
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click')
  expect(calls.patch).not.toHaveBeenCalled()
  expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  wrapper.unmount()
})

it('restaura los borradores de descarga y fecha tras un rechazo explícito', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockReset().mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { detail: 'rechazado' } } })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  const checkbox = wrapper.get('input[aria-label="Permitir descarga por etiqueta QUIMICA"]')
  const date = wrapper.get('input[aria-label="Caducidad de etiqueta QUIMICA"]')
  const original = (date.element as HTMLInputElement).value
  await checkbox.setValue(true); await date.setValue('2032-06-15T13:45')
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('rechazado')
  expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  expect((date.element as HTMLInputElement).value).toBe(original)
  wrapper.unmount()
})

it('restaura el borrador directo tras un rechazo explícito', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const rows = [{ material: { id: 7, title: 'Archivo', filename: 'a.pdf', kind: 'pdf' }, direct: { id: 5, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }, tags: [] }]
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/material-access') ? rows : [] }))
  calls.patch.mockReset().mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { detail: 'rechazado' } } })
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  const checkbox = wrapper.get('.student-grant-row input[type="checkbox"]')
  const date = wrapper.get('input[aria-label="Caducidad de Archivo"]')
  const original = (date.element as HTMLInputElement).value
  await checkbox.setValue(true); await date.setValue('2032-06-15T13:45')
  await wrapper.get('.student-grant-row .save-direct').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('rechazado')
  expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  expect((date.element as HTMLInputElement).value).toBe(original)
  wrapper.unmount()
})

it('permite reintentar lectura fallida tras concesión parcial sin repetir la concesión confirmada', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }]
  let failed = false
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => failed && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, code: 'ERR_NETWORK' }) : Promise.resolve({ data: url === '/admin/tags' ? tags : [] }))
  calls.post.mockReset().mockResolvedValueOnce({}).mockImplementationOnce(() => { failed = true; return Promise.reject({ isAxiosError: true, response: { status: 400, data: { detail: 'rechazado' } } }) }).mockResolvedValue({})
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access select').setValue('tag')
  const checkboxes = wrapper.findAll('fieldset input[type="checkbox"]')
  await checkboxes[0]!.setValue(true); await checkboxes[1]!.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(permissionTimeoutToast.value).toBe('')
  expect(wrapper.text()).toContain('Se concedieron 1 etiquetas')
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Se concedieron 1 etiquetas (QUIMICA)')
  expect(calls.post).toHaveBeenCalledTimes(2)
  failed = false; await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Se concedieron 1 etiquetas (QUIMICA)')
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(3)
  expect(calls.post.mock.calls.map(call => call[1].tag_id)).toEqual([2, 3, 3])
  wrapper.unmount()
})

it('descarta una etiqueta eliminada durante la recuperación de un fallo parcial', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }, { id: 4, name: 'BIOLOGIA' }, { id: 5, name: 'MATEMATICAS' }, { id: 6, name: 'GEOLOGIA' }]
  let failRead = false, removed = false
  calls.get.mockImplementation((url: string) => failRead && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, code: 'ERR_NETWORK' }) : Promise.resolve({ data: url === '/admin/tags' ? tags.filter(tag => !removed || tag.id !== 5) : [] }))
  calls.post.mockReset().mockResolvedValueOnce({}).mockImplementationOnce(() => { failRead = true; return Promise.reject({ isAxiosError: true, response: { status: 400, data: { detail: 'rechazado' } } }) }).mockResolvedValue({})
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access select').setValue('tag')
  for (const checkbox of wrapper.findAll('fieldset input[type="checkbox"]')) await checkbox.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  failRead = false; removed = true
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Se concedieron 1 etiquetas (QUIMICA)')
  expect(wrapper.text()).toContain('Se descartó la etiqueta MATEMATICAS porque ya no está disponible.')
  const remaining = wrapper.findAll('fieldset input[type="checkbox"]')
  expect(remaining.map(input => (input.element as HTMLInputElement).checked)).toEqual([false, true, true, true])
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post.mock.calls.map(call => call[1].tag_id)).toEqual([2, 3, 3, 4, 6])
  expect(wrapper.text()).not.toContain('Se descartó la etiqueta MATEMATICAS')
  wrapper.unmount()
})

it('avisa de varias etiquetas descartadas y retira el aviso tras una recarga posterior', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }, { id: 4, name: 'BIOLOGIA' }]
  let failRead = false, removed = false
  calls.get.mockImplementation((url: string) => failRead && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, code: 'ERR_NETWORK' }) : Promise.resolve({ data: url === '/admin/tags' ? tags.filter(tag => !removed || tag.id === 2) : [] }))
  calls.post.mockReset().mockResolvedValueOnce({}).mockImplementationOnce(() => { failRead = true; return Promise.reject({ isAxiosError: true, response: { status: 400, data: { detail: 'rechazado' } } }) })
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access select').setValue('tag')
  for (const checkbox of wrapper.findAll('fieldset input[type="checkbox"]')) await checkbox.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  failRead = false; removed = true
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Se descartaron las etiquetas FISICA, BIOLOGIA porque ya no están disponibles.')
  // Una nueva lectura fallida y su reintento restauran el catálogo completo.
  calls.post.mockImplementationOnce(() => { failRead = true; return Promise.resolve({}) })
  await wrapper.get('fieldset input[type="checkbox"]').setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  failRead = false; removed = false
  await wrapper.get('[role="alert"] button').trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('Se descartaron las etiquetas')
  expect(wrapper.text()).toContain('FISICA')
  wrapper.unmount()
})

it('oculta permisos anteriores mientras se recarga tras un éxito parcial', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }]
  const grant = { id: 11, tag: { id: 4, name: 'ANTIGUA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  let reload = false, finish!: (value: { data: unknown[] }) => void
  calls.get.mockImplementation((url: string) => reload && url.endsWith('/material-access') ? new Promise(resolve => { finish = resolve }) : Promise.resolve({ data: url === '/admin/tags' ? tags : url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.post.mockReset().mockResolvedValueOnce({}).mockImplementationOnce(() => { reload = true; return Promise.reject({ isAxiosError: true, response: { status: 400, data: { detail: 'rechazado' } } }) })
  const wrapper = mount(StudentMaterialsModal, { props: { student }, attachTo: document.body }); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: ANTIGUA')
  await wrapper.get('.add-access select').setValue('tag')
  for (const checkbox of wrapper.findAll('fieldset input[type="checkbox"]')) await checkbox.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).not.toContain('Etiqueta: ANTIGUA')
  expect(wrapper.text()).toContain('Cargando materiales')
  expect(document.activeElement).toBe(wrapper.get('button[aria-label="Cerrar materiales"]').element)
  finish({ data: [] }); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: ANTIGUA')
  expect(wrapper.get('[role="alert"]').text()).toContain('Se concedieron 1 etiquetas (QUIMICA)')
  expect(wrapper.get('[role="alert"]').text()).toContain('rechazado')
  wrapper.unmount()
})

it('notifica el éxito parcial de etiquetas aunque también falle la recarga', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }]
  let failed = false
  calls.get.mockImplementation((url: string) => failed && url.endsWith('/material-access') ? Promise.reject({ isAxiosError: true, response: { data: { detail: 'fallo de recarga' } } }) : Promise.resolve({ data: url === '/admin/tags' ? tags : [] }))
  calls.post.mockReset().mockResolvedValueOnce({}).mockImplementationOnce(() => { failed = true; return Promise.reject({ isAxiosError: true, response: { data: { detail: 'fallo segunda etiqueta' } } }) })
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access select').setValue('tag')
  const checkboxes = wrapper.findAll('fieldset input[type="checkbox"]')
  await checkboxes[0]!.setValue(true); await checkboxes[1]!.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(2)
  expect(wrapper.emitted('changed')).toHaveLength(1)
  expect(wrapper.text().match(/Se concedieron 1 etiquetas/g)).toHaveLength(1)
  expect(wrapper.text()).toContain('Se concedieron 1 etiquetas (QUIMICA)')
  expect(wrapper.get('[role="alert"]').text()).toContain('fallo segunda etiqueta')
  expect(wrapper.get('[role="alert"]').text()).toContain('fallo de recarga')
  wrapper.unmount()
})

it('al reintentar una asignación parcial no vuelve a conceder la etiqueta ya aplicada', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }]
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/tags' ? tags : [] }))
  calls.post.mockReset().mockResolvedValueOnce({}).mockRejectedValueOnce({ isAxiosError: true, response: { data: { detail: 'fallo segunda etiqueta' } } }).mockResolvedValueOnce({})
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access select').setValue('tag')
  for (const checkbox of wrapper.findAll('fieldset input[type="checkbox"]')) await checkbox.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('QUIMICA')
  const checkboxes = wrapper.findAll('fieldset input[type="checkbox"]')
  expect((checkboxes[0]!.element as HTMLInputElement).checked).toBe(false)
  expect((checkboxes[1]!.element as HTMLInputElement).checked).toBe(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(3)
  expect(calls.post.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ tag_id: 3 }))
  wrapper.unmount()
})

it('muestra el fallo y vuelve a permitir cerrar al terminar la operación', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  let reject!: (reason: unknown) => void
  calls.patch.mockImplementation(() => new Promise((_, fail) => { reject = fail }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click')
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('click')
  expect(wrapper.emitted('close')).toBeUndefined()
  reject({ isAxiosError: true, response: { data: { detail: 'guardado fallido' } } }); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('guardado fallido')
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('click')
  expect(wrapper.emitted('close')).toHaveLength(1)
  wrapper.unmount()
})

it.each([{ code: 'ECONNABORTED' }, { code: 'ETIMEDOUT' }, { code: 'ERR_NETWORK' }, { response: { status: 502 } }, { response: { status: 503 } }, { response: { status: 504 } }])('muestra el aviso solicitado si la petición falla sin respuesta (%j)', async (failure) => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  let reject!: (reason: unknown) => void
  calls.patch.mockImplementation(() => new Promise((_, fail) => { reject = fail }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click')
  expect(calls.patch.mock.calls.at(-1)?.[2]).toEqual({ timeout: 30000 })
  wrapper.unmount(); reject({ isAxiosError: true, ...failure }); await flushPromises()
  expect(permissionTimeoutToast.value).toBe('Internal error, please reload the page')
})

it('presenta el aviso global de tiempo agotado en la aplicación', async () => {
  const { default: App } = await import('../src/App.vue')
  const { createMemoryHistory, createRouter } = await import('vue-router')
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div>Inicio</div>' } }] })
  calls.get.mockResolvedValue({ data: {} })
  await router.push('/'); await router.isReady()
  permissionTimeoutToast.value = 'Internal error, please reload the page'
  const wrapper = mount(App, { global: { plugins: [router], stubs: { LogoViewer: true, BrandSettings: true } } }); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toBe('Internal error, please reload the page')
  wrapper.unmount(); permissionTimeoutToast.value = ''
})

it('bloquea navegación y controles de fondo mientras hay una operación pendiente', async () => {
  const { default: App } = await import('../src/App.vue')
  const { createMemoryHistory, createRouter } = await import('vue-router')
  const { session } = await import('../src/services/session')
  session.user = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest', is_active: true, has_avatar: false }
  const click = vi.fn()
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<button @click="click">Cambiar vista</button>', setup: () => ({ click }) } }, { path: '/otra', component: { template: '<div>Otra</div>' } }] })
  calls.get.mockResolvedValue({ data: {} })
  await router.push('/'); await router.isReady()
  const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router], stubs: { LogoViewer: true, BrandSettings: true } } }); await flushPromises()
  permissionMutationPending.value = true
  await wrapper.get('main button').trigger('click')
  expect(click).not.toHaveBeenCalled()
  const outside = document.createElement('button')
  document.body.append(outside)
  const outsideEvent = vi.fn()
  for (const type of ['click', 'keydown', 'change']) outside.addEventListener(type, outsideEvent)
  for (const type of ['click', 'keydown', 'change']) outside.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))
  expect(outsideEvent).not.toHaveBeenCalled()
  outside.remove()
  await router.push('/otra')
  expect(router.currentRoute.value.path).toBe('/')
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  session.user = null
  const expiredEvent = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(expiredEvent)
  expect(expiredEvent.defaultPrevented).toBe(false)
  permissionMutationPending.value = false
  await wrapper.get('main button').trigger('click')
  expect(click).toHaveBeenCalledOnce()
  await router.push('/otra')
  expect(router.currentRoute.value.path).toBe('/otra')
  wrapper.unmount()
})

it('oculta permisos y controles previos si una mutación agota el tiempo', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockRejectedValue({ isAxiosError: true, code: 'ETIMEDOUT' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  expect(wrapper.text()).toContain('Etiqueta: QUIMICA')
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('Etiqueta: QUIMICA')
  expect(wrapper.find('button[aria-label="Guardar etiqueta QUIMICA"]').exists()).toBe(false)
  wrapper.unmount(); permissionTimeoutToast.value = ''
})

it.each([{ code: 'ETIMEDOUT' }, { response: { status: 502 } }, { response: { status: 503 } }])('no continúa asignando etiquetas tras un fallo parcial incierto (%j)', async (failure) => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const tags = [{ id: 2, name: 'QUIMICA' }, { id: 3, name: 'FISICA' }, { id: 4, name: 'MATEMATICAS' }]
  permissionTimeoutToast.value = ''
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/admin/tags' ? tags : [] }))
  calls.post.mockReset().mockResolvedValueOnce({}).mockRejectedValueOnce({ isAxiosError: true, ...failure })
  const wrapper = mount(StudentMaterialsModal, { props: { student } }); await flushPromises()
  await wrapper.get('.add-access select').setValue('tag')
  for (const checkbox of wrapper.findAll('fieldset input[type="checkbox"]')) await checkbox.setValue(true)
  await wrapper.get('.add-access form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledTimes(2)
  expect(wrapper.emitted('changed')).toHaveLength(1)
  expect(permissionTimeoutToast.value).toBe('Internal error, please reload the page')
  expect(wrapper.text()).toContain('QUIMICA')
  expect(wrapper.text()).toContain('Se concedieron 1 etiquetas')
  wrapper.unmount(); permissionTimeoutToast.value = ''
})

it('impide cerrar por botón, Escape o fondo mientras se guarda y permite cerrar al terminar', async () => {
  const student = { id: 3, name: 'Alumna', email: 'a@example.test', role: 'guest' as const, is_active: true, has_avatar: false }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/tag-grants') ? [grant] : [] }))
  let finish!: (value: object) => void
  calls.patch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentMaterialsModal, { props: { student }, attachTo: document.body }); await flushPromises()
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click')
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('click')
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('keydown', { key: 'Escape' })
  await wrapper.get('.student-access-overlay').trigger('click')
  expect(wrapper.emitted('close')).toBeUndefined()
  expect(wrapper.get('[role="status"]').text()).toContain('Guardando')
  expect(wrapper.get('.access-body').attributes('inert')).toBeDefined()
  finish({}); await flushPromises()
  expect(wrapper.get('.access-body').attributes('inert')).toBeUndefined()
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('click')
  expect(wrapper.emitted('close')).toHaveLength(1)
  wrapper.unmount()
})
