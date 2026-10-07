import { type Task, TaskState } from '@a2a-js/sdk'
import { ServerCallContext, type TaskStore } from '@a2a-js/sdk/server'
import { describe, expect, it } from 'vitest'
import { createBoundedTaskStore } from '../src/task-store.js'

const context = new ServerCallContext()

function task(id: string, state: TaskState, at: string): Task {
  return {
    id,
    contextId: 'ctx',
    status: { state, timestamp: at },
    artifacts: [],
    history: [],
    metadata: undefined,
    kind: undefined,
    messageId: undefined,
    referenceTaskIds: [],
    pushNotification: undefined,
    extensions: [],
  } as unknown as Task
}

describe('boundedTaskStore', () => {
  it('evicts the oldest terminal tasks beyond capacity', async () => {
    const store: TaskStore = createBoundedTaskStore({
      maxTasks: 3,
      ttlMs: 3_600_000,
      now: () => Date.parse('2026-01-01T00:01:00Z'),
    })
    for (let i = 0; i < 6; i++) {
      await store.save(
        task(
          `t${i}`,
          TaskState.TASK_STATE_COMPLETED,
          `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
        ),
        context,
      )
    }
    expect(await store.load('t0', context)).toBeUndefined()
    expect(await store.load('t1', context)).toBeUndefined()
    expect(await store.load('t2', context)).toBeUndefined()
    expect(await store.load('t5', context)).toBeDefined()
  })

  it('evicts terminal tasks past the TTL but never live ones', async () => {
    const store: TaskStore = createBoundedTaskStore({
      maxTasks: 100,
      ttlMs: 1_000,
      now: () => Date.parse('2026-01-02T00:00:00Z'),
    })
    await store.save(
      task('old-done', TaskState.TASK_STATE_COMPLETED, '2026-01-01T00:00:00Z'),
      context,
    )
    await store.save(
      task('old-live', TaskState.TASK_STATE_WORKING, '2026-01-01T00:00:00Z'),
      context,
    )
    // The next save triggers the sweep.
    await store.save(task('fresh', TaskState.TASK_STATE_COMPLETED, '2026-01-02T00:00:00Z'), context)
    expect(await store.load('old-done', context)).toBeUndefined()
    expect(await store.load('old-live', context)).toBeDefined()
    expect(await store.load('fresh', context)).toBeDefined()
  })

  it('delegates saves and loads faithfully', async () => {
    const store: TaskStore = createBoundedTaskStore({
      maxTasks: 10,
      ttlMs: 3_600_000,
      now: () => Date.parse('2026-01-01T00:01:00Z'),
    })
    const saved = task('kept', TaskState.TASK_STATE_COMPLETED, '2026-01-01T00:00:00Z')
    await store.save(saved, context)
    const loaded = await store.load('kept', context)
    expect(loaded?.id).toBe('kept')
  })
})
