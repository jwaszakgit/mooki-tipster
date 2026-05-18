import { openDB } from 'idb'

const DB_NAME = 'mooki-tipster'
const DB_VERSION = 1
const STORE_NAME = 'app-data'

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME)
    },
  })
}

export async function saveLocalData(data: unknown): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, data, 'state')
}

export async function getLocalData(): Promise<unknown | null> {
  const db = await getDB()
  return (await db.get(STORE_NAME, 'state')) ?? null
}

export async function clearLocalData(): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, 'state')
}
