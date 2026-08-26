import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoursePaymentOptions } from '../lib/course-payment-options.ts'

const course = {
  priceHuf: 330_000,
  discountedPriceHuf: 250_000,
  discountedPaymentDeadline: '2026-09-01T12:00:00.000Z',
  installmentEnabled: true,
  installmentCount: 3,
  installmentAmountHuf: 120_000,
  installmentDueDates: ['2026-09-10T12:00:00.000Z', null, '2026-11-10T12:00:00.000Z'],
}

test('a kurzus saját árai és részlethatáridői kerülnek a konstrukciókba', () => {
  const options = buildCoursePaymentOptions(course, new Date('2026-08-01T12:00:00.000Z'))
  assert.equal(options.standard?.total, 330_000)
  assert.equal(options['early-bird']?.total, 250_000)
  assert.equal(options.installment?.total, 360_000)
  assert.deepEqual(options.installment?.dueDates, course.installmentDueDates)
})

test('a lejárt kedvezmény nem választható, a normál ár továbbra is elérhető', () => {
  const options = buildCoursePaymentOptions(course, new Date('2026-10-01T12:00:00.000Z'))
  assert.equal(options['early-bird']?.available, false)
  assert.equal(options.standard?.available, true)
})
