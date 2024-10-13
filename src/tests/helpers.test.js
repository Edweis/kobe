import { describe, it } from 'node:test'
import assert from "node:assert"
import { computeBalance, } from '../lib/helpers.js'

const cases = [
  [[], []],
  [
    new Map([['a', 10], ['b', -10]]),
    [{ from: 'b', to: 'a', amount: 10 }]
  ],
  [
    new Map([['a', 30], ['b', -10], ['c', -20]]),
    [{ from: 'c', to: 'a', amount: 20 }, { from: 'b', to: 'a', amount: 10 }]
  ],
  [
    new Map([['a', 70], ['b', 30], ['c', -100]]),
    [{ from: 'c', to: 'a', amount: 70 }, { from: 'c', to: 'b', amount: 30 }]
  ]
]
describe('computeBalance', () => {
  cases.forEach(([input, output], index) => {
    it('should work for case ' + index, () => {
      assert.deepEqual(computeBalance(input), output)
    })
  })
})
