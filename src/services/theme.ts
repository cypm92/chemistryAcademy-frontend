import { ref } from 'vue'
import { api } from './api'

const DEFAULT_COLOR = '#1D6B4F'

export const branding = ref({ primaryColor: DEFAULT_COLOR, logoUrl: null as string | null })

function mix(hex: string, target: string, weight: number): string {
  const source = hex.replace('#', '')
  const destination = target.replace('#', '')
  const channel = (start: number) => Math.round(
    parseInt(source.slice(start, start + 2), 16) * (1 - weight)
    + parseInt(destination.slice(start, start + 2), 16) * weight,
  ).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

export function applyThemeColor(color: string) {
  const primary = /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : DEFAULT_COLOR
  const root = document.documentElement.style
  root.setProperty('--brand-green', primary)
  root.setProperty('--green', primary)
  root.setProperty('--ink', mix(primary, '#10251D', .34))
  root.setProperty('--mint', mix(primary, '#FFFFFF', .84))
  root.setProperty('--lime', mix(primary, '#FFFFFF', .66))
  root.setProperty('--line', mix(primary, '#FFFFFF', .78))
  root.setProperty('--brand-accent', mix(primary, '#FFFFFF', .28))
  root.setProperty('--brand-pale', mix(primary, '#FFFFFF', .72))
  root.setProperty('--brand-border', mix(primary, '#FFFFFF', .48))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', primary)
}

export async function loadThemeColor(): Promise<string> {
  return loadBranding()
}

export async function loadBranding(): Promise<string> {
  try {
    const { data } = await api.get('/branding')
    applyThemeColor(data.primary_color)
    branding.value = {
      primaryColor: data.primary_color,
      logoUrl: data.has_custom_logo ? `/api/branding/logo?v=${Date.now()}` : null,
    }
    return data.primary_color
  } catch {
    applyThemeColor(DEFAULT_COLOR)
    branding.value = { primaryColor: DEFAULT_COLOR, logoUrl: null }
    return DEFAULT_COLOR
  }
}
