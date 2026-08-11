<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { api, errorMessage, protectedBlobUrl } from '../services/api'
import { session, updateSessionUser } from '../services/session'

const form = reactive({
  name: session.user?.name || '',
  email: session.user?.email || '',
  current_password: '',
  new_password: '',
  confirm_password: '',
})
const error = ref('')
const success = ref('')
const saving = ref(false)
const avatarFile = ref<File | null>(null)
const avatarPreview = ref('')
const savedAvatarUrl = ref('')

async function loadSavedAvatar() {
  if (!session.user?.has_avatar) return
  try { savedAvatarUrl.value = await protectedBlobUrl('/auth/me/avatar') } catch { savedAvatarUrl.value = '' }
}

function selectAvatar(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarFile.value = file
  avatarPreview.value = file ? URL.createObjectURL(file) : ''
}

onMounted(loadSavedAvatar)
onBeforeUnmount(() => {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  if (savedAvatarUrl.value) URL.revokeObjectURL(savedAvatarUrl.value)
})

async function save() {
  error.value = ''
  success.value = ''
  if (form.new_password && form.new_password !== form.confirm_password) {
    error.value = 'La nueva contraseña y su confirmación no coinciden.'
    return
  }
  saving.value = true
  try {
    const { data } = await api.patch('/auth/me', {
      name: form.name,
      email: form.email,
      current_password: form.current_password || null,
      new_password: form.new_password || null,
    })
    updateSessionUser(data)
    if (avatarFile.value) {
      const avatar = new FormData()
      avatar.append('file', avatarFile.value)
      const { data: avatarUser } = await api.put('/auth/me/avatar', avatar)
      updateSessionUser(avatarUser)
      avatarFile.value = null
      if (savedAvatarUrl.value) URL.revokeObjectURL(savedAvatarUrl.value)
      savedAvatarUrl.value = avatarPreview.value
      avatarPreview.value = ''
    }
    form.current_password = ''
    form.new_password = ''
    form.confirm_password = ''
    success.value = 'Tu perfil se ha actualizado correctamente.'
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="page profile-page">
    <div class="profile-card">
      <p class="eyebrow">CUENTA PERSONAL</p>
      <h1>Mi perfil</h1>
      <p class="profile-intro">Actualiza tus datos de acceso a la academia.</p>

      <form @submit.prevent="save">
        <div class="avatar-editor">
          <img v-if="avatarPreview || savedAvatarUrl" :src="avatarPreview || savedAvatarUrl" alt="Vista previa de tu foto de perfil" />
          <span v-else class="avatar-placeholder">{{ session.user?.name.slice(0, 1).toUpperCase() }}</span>
          <div><b>Imagen de perfil</b><small>JPG, PNG o WebP · máximo 5 MB</small><label class="avatar-upload">Elegir imagen<input type="file" accept="image/jpeg,image/png,image/webp" @change="selectAvatar" /></label></div>
        </div>
        <label>Nombre<input v-model.trim="form.name" required minlength="2" maxlength="120" autocomplete="name" /></label>
        <label>Correo electrónico<input v-model.trim="form.email" required type="email" autocomplete="email" /></label>

        <div class="profile-divider"><span>Seguridad</span></div>
        <p class="profile-help">Para cambiar el correo o la contraseña, introduce primero tu contraseña actual.</p>
        <label>Contraseña actual<input v-model="form.current_password" type="password" minlength="8" autocomplete="current-password" /></label>
        <label>Nueva contraseña <small>(opcional)</small><input v-model="form.new_password" type="password" minlength="8" autocomplete="new-password" /></label>
        <label>Confirmar nueva contraseña<input v-model="form.confirm_password" type="password" minlength="8" autocomplete="new-password" /></label>

        <p v-if="error" class="alert">{{ error }}</p>
        <p v-if="success" class="success-alert">{{ success }}</p>
        <button class="primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </form>
    </div>
  </section>
</template>
