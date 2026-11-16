// @vitest-environment jsdom
import { it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StudentsView from '../src/views/StudentsView.vue'
import { permissionTimeoutToast } from '../src/services/permissionTimeoutToast'
const calls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('../src/services/api', () => ({ api: calls, errorMessage: (e: Error) => e.message }))
it('abre y cancela el alta desde la cabecera', async () => {
  calls.get.mockResolvedValue({ data: [] })
  const wrapper = mount(StudentsView, { attachTo: document.body }); await flushPromises()
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  await wrapper.get('button.new-student-button').trigger('click')
  expect(wrapper.get('[role="dialog"]').text()).toContain('Crear estudiante')
  expect(wrapper.get('input[name="student-password"]').attributes('type')).toBe('password')
  await wrapper.get('button[aria-label="Mostrar contraseña"]').trigger('click')
  expect(wrapper.get('input[name="student-password"]').attributes('type')).toBe('text')
  await wrapper.get('button[aria-label="Ocultar contraseña"]').trigger('click')
  expect(wrapper.get('input[name="student-password"]').attributes('type')).toBe('password')
  await wrapper.get('button[aria-label="Cerrar alta de alumno"]').trigger('click')
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  wrapper.unmount()
})
it('crea el alumno y actualiza la tabla', async () => {
  calls.get.mockResolvedValue({ data: [] }); calls.post.mockResolvedValue({})
  const wrapper = mount(StudentsView); await flushPromises()
  await wrapper.get('button.new-student-button').trigger('click')
  await wrapper.get('input[name="student-name"]').setValue('Alumno Test')
  await wrapper.get('input[name="student-email"]').setValue('a@example.test')
  await wrapper.get('input[name="student-password"]').setValue('longpassword')
  await wrapper.get('form.new-student-form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledWith('/admin/users', { name: 'Alumno Test', email: 'a@example.test', password: 'longpassword', role: 'guest' })
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  wrapper.unmount()
})
it('guarda el estado seleccionado como booleano', async () => {
  const user = { id: 4, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }
  calls.get.mockResolvedValue({ data: [user] }); calls.patch.mockResolvedValue({})
  const wrapper = mount(StudentsView); await flushPromises()
  await wrapper.get('.row-actions .edit-button').trigger('click')
  expect(wrapper.get('input[name="edit-password"]').attributes('type')).toBe('password')
  await wrapper.get('button[aria-label="Mostrar contraseña"]').trigger('click')
  expect(wrapper.get('input[name="edit-password"]').attributes('type')).toBe('text')
  await wrapper.get('button[aria-label="Ocultar contraseña"]').trigger('click')
  expect(wrapper.get('input[name="edit-password"]').attributes('type')).toBe('password')
  await wrapper.get('select[aria-label="Estado de la cuenta"]').setValue(false)
  await wrapper.get('.user-edit-form').trigger('submit'); await flushPromises()
  expect(calls.patch).toHaveBeenCalledWith('/admin/users/4', expect.objectContaining({ is_active: false }))
  wrapper.unmount()
})
it('separa roles, filtra estados y permite crear administradores', async () => {
  calls.get.mockResolvedValue({ data: [
    { id: 1, name: 'Alumna Activa', email: 'a@example.test', role: 'guest', is_active: true },
    { id: 2, name: 'Alumno Inactivo', email: 'b@example.test', role: 'guest', is_active: false },
    { id: 3, name: 'Admin Activo', email: 'c@example.test', role: 'admin', is_active: true },
    { id: 4, name: 'Admin Inactivo', email: 'd@example.test', role: 'admin', is_active: false },
  ] }); calls.post.mockResolvedValue({})
  const wrapper = mount(StudentsView); await flushPromises()
  expect(wrapper.text()).toContain('Alumna Activa')
  expect(wrapper.find('.students-panel-head .role-switch').exists()).toBe(true)
  expect(wrapper.get('button[aria-label="Ver activos"]').attributes('aria-pressed')).toBe('true')
  expect(wrapper.get('.row-actions .remove-button').text()).toBe('×')
  expect(wrapper.get('.row-actions .remove-button').attributes('aria-label')).toContain('Eliminar a')
  expect(wrapper.text()).not.toContain('Alumno Inactivo')
  expect(wrapper.text()).not.toContain('Admin Activo')
  expect(wrapper.findAll('th').map(h => h.text())).not.toContain('Rol')
  await wrapper.get('button[aria-label="Ver inactivos"]').trigger('click')
  expect(wrapper.get('button[aria-label="Ver inactivos"]').attributes('aria-pressed')).toBe('true')
  expect(wrapper.text()).toContain('Alumno Inactivo')
  expect(wrapper.text()).not.toContain('Alumna Activa')
  await wrapper.get('button[aria-label="Ver administradores"]').trigger('click')
  expect(wrapper.text()).toContain('Admin Inactivo')
  expect(wrapper.text()).not.toContain('Admin Activo')
  expect(wrapper.text()).not.toContain('Alumna Activa')
  await wrapper.get('button[aria-label="Ver activos"]').trigger('click')
  await wrapper.findAll('.row-actions .edit-button')[0].trigger('click')
  expect(wrapper.get('[role="dialog"]').text()).toContain('Editar administrador')
  expect(wrapper.findAll('.user-edit-form select')).toHaveLength(1)
  expect(wrapper.get('.user-edit-form select').attributes('aria-label')).toBe('Estado de la cuenta')
  await wrapper.get('.user-edit-form .secondary').trigger('click')
  await wrapper.get('button.new-student-button').trigger('click')
  expect(wrapper.get('[role="dialog"]').text()).toContain('Crear administrador')
  await wrapper.get('input[name="student-name"]').setValue('Admin Nuevo')
  await wrapper.get('input[name="student-email"]').setValue('new@example.com')
  await wrapper.get('input[name="student-password"]').setValue('longpassword')
  await wrapper.get('form.new-student-form').trigger('submit'); await flushPromises()
  expect(calls.post).toHaveBeenCalledWith('/admin/users', expect.objectContaining({ role: 'admin' }))
  wrapper.unmount()
})
it('confirma eliminación en diálogo y permite cancelar sin borrar', async () => {
  calls.delete.mockReset(); calls.delete.mockResolvedValue({})
  calls.get.mockResolvedValue({ data: [{ id: 7, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }] })
  const wrapper = mount(StudentsView); await flushPromises()
  await wrapper.get('.row-actions .remove-button').trigger('click')
  expect(wrapper.get('[role="dialog"]').text()).toContain('Alumno')
  expect(calls.delete).not.toHaveBeenCalled()
  await wrapper.get('[data-cancel-delete]').trigger('click')
  expect(calls.delete).not.toHaveBeenCalled()
  await wrapper.get('.row-actions .remove-button').trigger('click')
  await wrapper.get('[data-confirm-delete]').trigger('click'); await flushPromises()
  expect(calls.delete).toHaveBeenCalledWith('/admin/users/7')
  wrapper.unmount()
})
it('muestra etiquetas vigentes y total de archivos de cada alumno', async () => {
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users/access-summary'
    ? [{ user_id: 7, tags: [{ id: 2, name: 'QUÍMICA' }], file_count: 3 }]
    : [{ id: 7, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }] }))
  const wrapper = mount(StudentsView); await flushPromises()
  expect(wrapper.findAll('th').map(x => x.text())).toEqual(['Alumno', 'Email', 'Etiquetas', 'Archivos', 'Acciones'])
  expect(wrapper.get('tbody tr').findAll('td')[1].text()).toBe('a@example.test')
  expect(wrapper.get('tbody tr').text()).toContain('QUÍMICA')
  expect(wrapper.get('tbody tr').text()).toContain('3')
  wrapper.unmount()
})
it('permite reintentar el resumen cuando falla sin mostrar cifras antiguas', async () => {
  let fail = true
  calls.get.mockImplementation((path: string) => path === '/admin/users/access-summary'
    ? fail ? Promise.reject(new Error('fallo')) : Promise.resolve({ data: [{ user_id: 7, tags: [], file_count: 2 }] })
    : Promise.resolve({ data: [{ id: 7, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }] }))
  const wrapper = mount(StudentsView); await flushPromises()
  expect(wrapper.text()).toContain('No se pudo cargar el resumen')
  expect(wrapper.get('tbody tr').text()).not.toContain('2')
  fail = false
  await wrapper.findAll('button').find(button => button.text() === 'Reintentar')!.trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('No se pudo cargar el resumen')
  expect(wrapper.get('tbody tr').text()).toContain('2')
  expect(wrapper.get('tbody tr').findAll('td')[2].text()).toBe('')
  wrapper.unmount()
})
it('separa nombre y email para distinguir usuarios con el mismo nombre en ambos roles', async () => {
  const users = [
    { id: 17, name: 'Alex', email: 'a@example.test', role: 'guest', is_active: true },
    { id: 23, name: 'Alex', email: 'b@example.test', role: 'guest', is_active: true },
    { id: 42, name: 'Alex', email: 'c@example.test', role: 'admin', is_active: true },
  ]
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? users : [] }))
  const wrapper = mount(StudentsView); await flushPromises()
  expect(wrapper.findAll('tbody tr:not(.table-spacer)').map(row => row.findAll('td').slice(0, 2).map(cell => cell.text()))).toEqual([['Alex', 'a@example.test'], ['Alex', 'b@example.test']])
  await wrapper.get('button[aria-label="Ver administradores"]').trigger('click')
  expect(wrapper.findAll('th').map(x => x.text())).toEqual(['Administrador', 'Email', 'Acciones'])
  expect(wrapper.get('tbody tr').findAll('td').slice(0, 2).map(cell => cell.text())).toEqual(['Alex', 'c@example.test'])
  wrapper.unmount()
})
it('conserva y permite buscar el correo completo aunque sea largo', async () => {
  const email = `${'alumno'.repeat(16)}@example.test`
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [{ id: 8, name: 'Alumno', email, role: 'guest', is_active: true }] : [] }))
  const wrapper = mount(StudentsView); await flushPromises()
  expect(wrapper.get('.user-email').text()).toBe(email)
  expect(wrapper.get('.user-email').attributes('title')).toBeUndefined()
  await wrapper.get('input[aria-label="Buscar por nombre o email"]').setValue(email)
  expect(wrapper.get('.user-email').text()).toBe(email)
  wrapper.unmount()
})
it('devuelve el foco al botón de materiales al cerrar el diálogo', async () => {
  const user = { id: 8, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [user] : [] }))
  const wrapper = mount(StudentsView, { attachTo: document.body }); await flushPromises()
  const button = wrapper.get('.row-actions .materials-button')
  ;(button.element as HTMLElement).focus()
  await button.trigger('click'); await flushPromises()
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('click'); await flushPromises()
  expect(document.activeElement).toBe(button.element)
  wrapper.unmount()
})
it('actualiza el resumen cuando el modal informa de un cambio', async () => {
  const user = { id: 8, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }
  let count = 0
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [user] : path === '/admin/users/access-summary' ? [{ user_id: 8, tags: [], file_count: count }] : [] }))
  const wrapper = mount(StudentsView, { global: { stubs: { StudentMaterialsModal: { template: '<button class="fake-change" @click="$emit(\'changed\')">Cambio</button>' } } } }); await flushPromises()
  await wrapper.get('.materials-button').trigger('click')
  count = 2; await wrapper.get('.fake-change').trigger('click'); await flushPromises()
  expect(wrapper.get('tbody tr').findAll('td')[3].text()).toBe('2')
  wrapper.unmount()
})
it('mantiene el diálogo abierto y muestra el fallo de un guardado real', async () => {
  const user = { id: 8, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [user] : path.endsWith('/tag-grants') ? [grant] : [] }))
  let reject!: (error: Error) => void
  calls.patch.mockImplementation(() => new Promise((_, fail) => { reject = fail }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const wrapper = mount(StudentsView); await flushPromises()
  await wrapper.get('.materials-button').trigger('click'); await flushPromises()
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click')
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('click')
  expect(wrapper.find('button[aria-label="Cerrar materiales"]').exists()).toBe(true)
  reject(new Error('falló el guardado')); await flushPromises()
  expect(wrapper.text()).toContain('falló el guardado')
  wrapper.unmount()
})
it('oculta el resumen anterior cuando una modificación termina sin respuesta', async () => {
  const user = { id: 8, name: 'Alumno', email: 'a@example.test', role: 'guest', is_active: true }
  const grant = { id: 11, tag: { id: 2, name: 'QUIMICA' }, starts_at: '2025-01-01T00:00:00Z', expires_at: '2030-01-01T10:30:00Z', can_download: false }
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? [user] : path === '/admin/users/access-summary' ? [{ user_id: 8, tags: [grant.tag], file_count: 7 }] : path.endsWith('/tag-grants') ? [grant] : [] }))
  calls.patch.mockRejectedValue({ isAxiosError: true, code: 'ETIMEDOUT' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  permissionTimeoutToast.value = ''
  const wrapper = mount(StudentsView); await flushPromises()
  expect(wrapper.get('tbody tr').text()).toContain('QUIMICA')
  await wrapper.get('.materials-button').trigger('click'); await flushPromises()
  await wrapper.get('button[aria-label="Guardar etiqueta QUIMICA"]').trigger('click'); await flushPromises()
  await wrapper.get('button[aria-label="Cerrar materiales"]').trigger('click'); await flushPromises()
  expect(wrapper.get('tbody tr').text()).not.toContain('QUIMICA')
  expect(wrapper.get('tbody tr').findAll('td')[3].text()).not.toBe('7')
  expect(wrapper.get('.materials-button').attributes('disabled')).toBeDefined()
  wrapper.unmount(); permissionTimeoutToast.value = ''
})
it('mantiene los datos y acciones de alumnos y administradores en la misma fila adaptable', async () => {
  const users = [
    { id: 1, name: 'Ana', email: 'ana@example.test', role: 'guest', is_active: true },
    { id: 2, name: 'Eva', email: 'eva@example.test', role: 'admin', is_active: true },
  ]
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? users : [{ user_id: 1, tags: [{ id: 5, name: 'PAU' }], file_count: 4 }] }))
  const wrapper = mount(StudentsView); await flushPromises()
  const row = wrapper.get('tbody tr:not(.table-spacer)')
  expect(row.get('[data-label="Email"]').text()).toBe('ana@example.test')
  expect(row.get('[data-label="Etiquetas"]').text()).toContain('PAU')
  expect(row.get('[data-label="Archivos"]').text()).toContain('4')
  expect(row.findAll('button').map(button => button.text())).toEqual(['Materiales', 'Editar', '×'])
  expect(row.get('.remove-button').attributes('aria-label')).toContain('Eliminar a')
  await wrapper.get('button[aria-label="Ver administradores"]').trigger('click')
  const admin = wrapper.get('tbody tr:not(.table-spacer)')
  expect(admin.get('[data-label="Email"]').text()).toBe('eva@example.test')
  expect(admin.findAll('button').map(button => button.text())).toEqual(['Editar'])
  wrapper.unmount()
})
it('pagina por diez y mantiene espacio en la última página', async () => {
  const users = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, name: `Alumno ${String(i + 1).padStart(2, '0')}`, email: `a${i}@example.test`, role: 'guest', is_active: true }))
  users.push(...Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Admin ${i + 1}`, email: `admin${i}@example.test`, role: 'admin', is_active: true })))
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? users : [] }))
  const wrapper = mount(StudentsView); await flushPromises()
  expect(wrapper.findAll('tbody tr:not(.table-spacer)')).toHaveLength(10)
  expect(wrapper.text()).toContain('Página 1 de 3')
  expect(wrapper.text()).not.toContain('Alumno 11')
  await wrapper.get('button[aria-label="Página siguiente"]').trigger('click')
  expect(wrapper.text()).toContain('Alumno 11')
  expect(wrapper.text()).not.toContain('Alumno 01')
  await wrapper.get('button[aria-label="Página siguiente"]').trigger('click')
  expect(wrapper.findAll('tbody tr:not(.table-spacer)')).toHaveLength(3)
  expect(wrapper.get('.table-spacer').attributes('aria-hidden')).toBe('true')
  expect(wrapper.get('.table-spacer td').attributes('style')).toContain('height: 308px')
  expect(wrapper.get('button[aria-label="Página siguiente"]').attributes('disabled')).toBeDefined()
  await wrapper.get('input[aria-label="Buscar por nombre o email"]').setValue('Alumno 01')
  expect(wrapper.text()).toContain('Página 1 de 1')
  expect(wrapper.text()).toContain('Alumno 01')
  await wrapper.get('input[aria-label="Buscar por nombre o email"]').setValue('')
  await wrapper.get('button[aria-label="Página siguiente"]').trigger('click')
  await wrapper.get('button[aria-label="Ver administradores"]').trigger('click')
  expect(wrapper.text()).toContain('Página 1 de 2')
  expect(wrapper.findAll('tbody tr:not(.table-spacer)')).toHaveLength(10)
  await wrapper.get('button[aria-label="Página siguiente"]').trigger('click')
  await wrapper.get('button[aria-label="Ver inactivos"]').trigger('click')
  expect(wrapper.text()).toContain('No se han encontrado administradores')
  expect(wrapper.text()).toContain('Página 1 de 1')
  wrapper.unmount()
})

it('ajusta la página si una recarga elimina la última página', async () => {
  let users = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, name: `Alumno ${i + 1}`, email: `a${i}@example.test`, role: 'guest', is_active: true }))
  calls.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/admin/users' ? users : [] }))
  const wrapper = mount(StudentsView, { props: { refreshKey: 0 } }); await flushPromises()
  await wrapper.get('button[aria-label="Página siguiente"]').trigger('click')
  users = users.slice(0, 10)
  await wrapper.setProps({ refreshKey: 1 }); await flushPromises()
  expect(wrapper.text()).toContain('Página 1 de 1')
  expect(wrapper.findAll('tbody tr:not(.table-spacer)')).toHaveLength(10)
  wrapper.unmount()
})
