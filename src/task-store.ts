/**
 * A bounded in-memory TaskStore: terminal tasks are swept for age and
 * capacity on every save, so long-lived endpoints cannot grow an unbounded
 * task ledger. Live (non-terminal) tasks are never evicted.
 *
 * @module dsh-a2a/task-store
 */

import { type ListTasksRequest, type ListTasksResponse, type Task, TaskState } from '@a2a-js/sdk'
import type { TaskStore } from '@a2a-js/sdk/server'

const TERMINAL: readonly TaskState[] = [
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_REJECTED,
]

export interface BoundedTaskStoreOptions {
  /** Maximum retained tasks (terminal ones are evicted oldest-first). */
  maxTasks?: number
  /** Terminal tasks older than this are evicted on the next save. */
  ttlMs?: number
  now?: () => number
}

/** Build a tenant-scoped TaskStore with capacity/TTL sweeping on save. */
export function createBoundedTaskStore(options: BoundedTaskStoreOptions = {}): TaskStore {
  const maxTasks = options.maxTasks ?? 256
  const ttlMs = options.ttlMs ?? 3_600_000
  const now = options.now ?? Date.now
  const tasks = new Map<string, Task>()
  const key = (tenant: string | undefined, id: string) => `${tenant ?? ''}\u0000${id}`
  const sweep = () => {
    const current = now()
    const terminal = [...tasks.values()]
      .filter((task) => TERMINAL.includes(task.status?.state as TaskState))
      .sort(
        (a, b) => Date.parse(a.status?.timestamp ?? '0') - Date.parse(b.status?.timestamp ?? '0'),
      )
    const expired = terminal.filter(
      (task) => current - Date.parse(task.status?.timestamp ?? '0') > ttlMs,
    )
    const overflow = terminal.length > maxTasks ? terminal.slice(0, terminal.length - maxTasks) : []
    for (const task of [...expired, ...overflow]) {
      tasks.delete(key(undefined, task.id))
      tasks.delete(key('', task.id))
    }
  }
  return {
    async save(task: Task): Promise<void> {
      // Index under the empty tenant: this endpoint does not resolve tenants.
      tasks.set(key('', task.id), task)
      try {
        sweep()
      } catch {
        // Sweeping is best-effort housekeeping; it must never fail a save.
      }
    },
    async load(taskId: string): Promise<Task | undefined> {
      return tasks.get(key('', taskId))
    },
    async list(params: ListTasksRequest): Promise<ListTasksResponse> {
      const all = [...tasks.values()].filter((task) => {
        if (params.contextId !== '' && task.contextId !== params.contextId) return false
        const state = params.status
        if (state !== undefined && state !== TaskState.TASK_STATE_UNSPECIFIED) {
          return task.status?.state === state
        }
        return true
      })
      const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 100)
      const offset = params.pageToken === '' ? 0 : Number.parseInt(params.pageToken, 10) || 0
      const page = all.slice(offset, offset + pageSize)
      return {
        tasks: page,
        nextPageToken: offset + pageSize < all.length ? String(offset + pageSize) : '',
        pageSize,
        totalSize: all.length,
      }
    },
  } as unknown as TaskStore
}
