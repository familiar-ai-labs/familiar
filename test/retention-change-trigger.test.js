const test = require('node:test')
const assert = require('node:assert/strict')
const { createRetentionChangeTrigger } = require('../src/storage/retention-change-trigger')

test('retention change trigger fires only when normalized retention value changes', () => {
  const calls = []
  const trigger = createRetentionChangeTrigger({
    resolveRetentionDays: (value) => (Number(value) === 7 ? 7 : 2),
    onRetentionChanged: (value) => calls.push(value)
  })

  assert.equal(trigger.handle(2), false)
  assert.equal(calls.length, 0)

  assert.equal(trigger.handle('2'), false)
  assert.equal(calls.length, 0)

  assert.equal(trigger.handle(7), true)
  assert.deepEqual(calls, [7])

  assert.equal(trigger.handle('9'), true)
  assert.deepEqual(calls, [7, 2])
})

test('retention change trigger uses initial retention as baseline', () => {
  const calls = []
  const trigger = createRetentionChangeTrigger({
    resolveRetentionDays: (value) => (Number(value) === 7 ? 7 : 2),
    initialRetentionDays: 2,
    onRetentionChanged: (value) => calls.push(value)
  })

  assert.equal(trigger.handle(2), false)
  assert.equal(calls.length, 0)

  assert.equal(trigger.handle(7), true)
  assert.deepEqual(calls, [7])
})
