import { describe, it } from 'node:test'
import assert from "node:assert"
import { computeBalance } from '../helpers.js'

const cases = [
  [ [], [] ],
  [ [{ from: 'a', to: ['a'], amount: 10 }], [] ],
  [
    [{ from: 'a', to: ['b'], amount: 10 }],
    [{ from: 'b', to: 'a', amount: 10 }]
  ],
  [
    [{ from: 'a', to: ['a', 'b'], amount: 10 }],
    [{ from: 'b', to: 'a', amount: 5 }]
  ],
  [
    [
      { from: 'a', to: ['a', 'b'], amount: 100 },
      { from: 'b', to: ['a'], amount: 10 }
    ],
    [{ from: 'b', to: 'a', amount: 40 }]
  ],
  [
    [
      { from: 'a', to: ['a', 'b'], amount: 100 },
      { from: 'b', to: ['a'], amount: 50 }
    ],
    []
  ],
  [
    [
      { from: 'a', to: ['b'], amount: 10 },
      { from: 'b', to: ['c'], amount: 10 },
      { from: 'c', to: ['a'], amount: 10 }
    ],
    []
  ],
  [
    [
      { from: 'a', to: ['a', 'b', 'c'], amount: 12 },
      { from: 'b', to: ['c'], amount: 12 },
      { from: 'c', to: ['a'], amount: 12 }
    ],
    []
  ],
].map(([input, output]) => {
  const lines = input.map(tx => {
    const amount = tx.amount / tx.to.length
    return { paid: tx.from, split: JSON.stringify(tx.to.map(p => ({ participant: p, amount, }))) }
  })
  return [lines, output]
})
describe('computeBalance', () => {
  cases.forEach(([input, output], index) => {
    it('should work for case '+index, () => {
      assert.deepEqual(computeBalance(input), output)
    })
  })
})