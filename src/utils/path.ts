import { sep } from '@tauri-apps/api/path'

export async function join(...paths: string[]): Promise<string> {
  const s = sep()
  const joined = paths.map((path, index) => {
    if (index === 0) return path.replace(new RegExp(`${escapeRegExp(s)}+$`), '')
    return path.replace(new RegExp(`^${escapeRegExp(s)}+|${escapeRegExp(s)}+$`, 'g'), '')
  })
  return joined.join(s)
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
