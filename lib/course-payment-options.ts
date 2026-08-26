import type { PackageConfig, PackageKey } from '@/lib/tabulama-config'

export interface CoursePricingSource {
  priceHuf: number
  discountedPriceHuf: number | null
  discountedPaymentDeadline: string | null
  installmentEnabled: boolean
  installmentCount: number | null
  installmentAmountHuf: number | null
  installmentDueDates: Array<string | null>
}

export interface CoursePaymentOption extends PackageConfig {
  available: boolean
  dueDates: Array<string | null>
}

export type CoursePaymentOptions = Record<PackageKey, CoursePaymentOption | null>

export interface ApplicationPricing {
  courseTitle: string
  packageName: string
  paymentType: 'lump-sum' | 'installment'
  totalHuf: number
  installmentCount: number | null
  installmentAmountHuf: number | null
  paymentDeadline: string | null
}

export function buildCoursePaymentOptions(course: CoursePricingSource, now: Date = new Date()): CoursePaymentOptions {
  const discountedAvailable = !course.discountedPaymentDeadline
    || new Date(course.discountedPaymentDeadline).getTime() >= now.getTime()
  const standard: CoursePaymentOption = {
    key: 'standard', name: 'Normál egyösszegű befizetés', paymentType: 'lump-sum',
    total: course.priceHuf, installmentCount: null, installmentAmount: null,
    paymentDeadline: null, bonusPrivateLessons: null, bonusLessonMinutes: null,
    savingsVsStandard: null, description: 'A kurzus teljes díja egy összegben.',
    available: true, dueDates: [null],
  }
  const discounted: CoursePaymentOption | null = course.discountedPriceHuf === null ? null : {
    key: 'early-bird', name: 'Kedvezményes egyösszegű befizetés', paymentType: 'lump-sum',
    total: course.discountedPriceHuf, installmentCount: null, installmentAmount: null,
    paymentDeadline: course.discountedPaymentDeadline, bonusPrivateLessons: null, bonusLessonMinutes: null,
    savingsVsStandard: Math.max(course.priceHuf - course.discountedPriceHuf, 0),
    description: 'A kurzus kedvezményes, egyösszegű díja.', available: discountedAvailable,
    dueDates: [course.discountedPaymentDeadline],
  }
  const installment: CoursePaymentOption | null = course.installmentEnabled
    && course.installmentCount && course.installmentAmountHuf
    ? {
        key: 'installment', name: 'Részletfizetés', paymentType: 'installment',
        total: course.installmentCount * course.installmentAmountHuf,
        installmentCount: course.installmentCount, installmentAmount: course.installmentAmountHuf,
        paymentDeadline: course.installmentDueDates.find(Boolean) ?? null,
        bonusPrivateLessons: null, bonusLessonMinutes: null, savingsVsStandard: null,
        description: `${course.installmentCount} × ${course.installmentAmountHuf.toLocaleString('hu-HU')} Ft.`,
        available: true,
        dueDates: Array.from({ length: course.installmentCount }, (_, index) => course.installmentDueDates[index] ?? null),
      }
    : null
  return { 'early-bird': discounted, standard, installment }
}

export function pricingForApplication(courseTitle: string, option: CoursePaymentOption): ApplicationPricing {
  return {
    courseTitle,
    packageName: option.name,
    paymentType: option.paymentType,
    totalHuf: option.total,
    installmentCount: option.installmentCount,
    installmentAmountHuf: option.installmentAmount,
    paymentDeadline: option.paymentDeadline,
  }
}
