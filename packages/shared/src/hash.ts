// Node-only: suppression-list hash, shared by worker and admin server so hashes always match.
import { createHash } from 'node:crypto'

export const hash = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex')
