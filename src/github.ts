import type { PantryData, SyncConfig } from './types'

export class ConflictError extends Error {}

const api = (c: SyncConfig) =>
  `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

const headers = (c: SyncConfig) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${c.token}`,
  'X-GitHub-Api-Version': '2022-11-28',
})

function b64encode(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function b64decode(b64: string) {
  const bin = atob(b64.replace(/\n/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

async function explain(res: Response) {
  if (res.status === 401) return 'Token ungültig oder abgelaufen'
  if (res.status === 403) return 'Token hat keine Schreibrechte auf dieses Repo'
  if (res.status === 404) return 'Repo nicht gefunden (Name prüfen, Token-Zugriff prüfen)'
  return `GitHub-Fehler ${res.status}`
}

/** Returns null when the data file does not exist yet. */
export async function loadRemote(c: SyncConfig): Promise<{ data: PantryData; sha: string } | null> {
  const res = await fetch(`${api(c)}?ref=${encodeURIComponent(c.branch)}&t=${Date.now()}`, {
    headers: headers(c),
    cache: 'no-store',
  })
  if (res.status === 404) {
    // distinguish "file missing" from "repo missing"
    const repo = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers: headers(c) })
    if (repo.ok) return null
    throw new Error(await explain(repo))
  }
  if (!res.ok) throw new Error(await explain(res))
  const json = await res.json()
  let text: string
  if (json.content) text = b64decode(json.content)
  else {
    // files > 1 MB: fetch raw
    const raw = await fetch(json.download_url ?? `${api(c)}?ref=${c.branch}`, {
      headers: { ...headers(c), Accept: 'application/vnd.github.raw' },
    })
    text = await raw.text()
  }
  return { data: JSON.parse(text) as PantryData, sha: json.sha }
}

export async function saveRemote(c: SyncConfig, data: PantryData, sha?: string) {
  const res = await fetch(api(c), {
    method: 'PUT',
    headers: { ...headers(c), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Vorrat aktualisiert ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      content: b64encode(JSON.stringify(data, null, 1)),
      branch: c.branch,
      ...(sha ? { sha } : {}),
    }),
  })
  if (res.status === 409 || res.status === 422) throw new ConflictError()
  if (!res.ok) throw new Error(await explain(res))
}

export async function testConnection(c: SyncConfig) {
  const res = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers: headers(c) })
  if (!res.ok) throw new Error(await explain(res))
  const repo = await res.json()
  if (!repo.permissions?.push) throw new Error('Token hat keine Schreibrechte auf dieses Repo')
  return { private: repo.private as boolean }
}
