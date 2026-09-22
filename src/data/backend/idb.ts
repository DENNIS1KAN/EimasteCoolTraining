/** Minimal IndexedDB blob store used by demo mode for uploaded files. */
const DB = 'ect-files'
const STORE = 'files'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const idbPut = (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key)).then(() => undefined)
export const idbGet = (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>)
export const idbDelete = (key: string) => tx('readwrite', (s) => s.delete(key)).then(() => undefined)
