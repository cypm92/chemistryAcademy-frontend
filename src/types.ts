export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'guest'
  is_active: boolean
}

export interface Material {
  id: number
  title: string
  description: string
  kind: 'video' | 'pdf'
  filename: string
  content_type: string
  size_bytes: number
  expires_at?: string
  can_download: boolean
  grants?: MaterialGrant[]
}

export interface MaterialGrant {
  id: number
  user_id: number
  material_id: number
  starts_at: string
  expires_at: string
  can_download: boolean
  user: User
}
