export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'guest'
  is_active: boolean
  has_avatar: boolean
}

export interface Material {
  id: number
  title: string
  description: string
  folder: Folder | null
  kind: 'video' | 'pdf'
  filename: string
  content_type: string
  size_bytes: number
  expires_at?: string
  can_download: boolean
  tags: Tag[]
  is_favorite: boolean
  grants?: MaterialGrant[]
}

export interface Tag {
  id: number
  name: string
}

export interface Folder {
  id: number
  name: string
  parent_id: number | null
  path: string
  color: string | null
  effective_color: string | null
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

export interface StudentMaterialGrant {
  id: number
  user_id: number
  material_id: number
  starts_at: string
  expires_at: string
  can_download: boolean
  material: {
    id: number
    title: string
    filename: string
    kind: 'video' | 'pdf'
  }
}

export interface Booking {
  id: number
  starts_at: string
  ends_at: string
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'blocked' | 'unavailable'
  note: string
  admin_comment: string
  user_id: number | null
  user_name: string | null
  is_mine: boolean
  user_email?: string | null
}

export interface AcademyClass {
  id: number
  starts_at: string
  ends_at: string
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled'
  is_historical: boolean
  topic: string
  admin_comment: string
  user_id: number
  user_name: string
  user_email: string
  materials: Array<{ id: number; title: string; filename: string; kind: 'video' | 'pdf' }>
}
