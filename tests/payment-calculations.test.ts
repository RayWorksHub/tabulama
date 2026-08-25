import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canRecordPayment,
  nextPaymentDueAt,
  paymentItemState,
  paymentPlanState,
} from '../lib/payment-calculations.ts'
import { PAYMENT_METHODS } from '../lib/admin-display.ts'

test('a banki átutalás és a készpénz is támogatott', () => {
  assert.deepEqual(PAYMENT_METHODS, ['bank_transfer', 'cash'])
})

test('részleges befizetést enged, túlfizetést blokkol', () => {
  assert.equal(canRecordPayment(4, 10), true)
  assert.equal(canRecordPayment(10, 10), true)
  assert.equal(canRecordPayment(11, 10), false)
})

test('részlet- és tervstátuszt a befizetés és határidő alapján számol', () => {
  const now = new Date('2026-09-10T12:00:00.000Z')
  assert.equal(paymentItemState({ amountHuf: 10, paidAmountHuf: 4, dueAt: null, now }), 'partially_paid')
  assert.equal(paymentItemState({ amountHuf: 10, paidAmountHuf: 4, dueAt: '2026-09-01T12:00:00.000Z', now }), 'overdue')
  assert.equal(paymentItemState({ amountHuf: 10, paidAmountHuf: 10, dueAt: '2026-09-01T12:00:00.000Z', now }), 'paid')
  assert.equal(paymentPlanState({ totalAmountHuf: 30, paidAmountHuf: 4, itemStatuses: ['overdue', 'pending'] }), 'overdue')
  assert.equal(paymentPlanState({ totalAmountHuf: 30, paidAmountHuf: 30, itemStatuses: ['paid', 'paid'] }), 'paid')
})

test('a következő ismert határidő a nyitott részletek legkorábbi dátuma', () => {
  assert.equal(nextPaymentDueAt([
    { remainingAmountHuf: 0, dueAt: '2026-09-01T12:00:00.000Z' },
    { remainingAmountHuf: 10, dueAt: '2026-11-01T12:00:00.000Z' },
    { remainingAmountHuf: 10, dueAt: '2026-10-01T12:00:00.000Z' },
  ]), '2026-10-01T12:00:00.000Z')
})
