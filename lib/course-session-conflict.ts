export const COURSE_SESSION_CONFLICT_RELATIONS = [
  'exact',
  'inside_existing',
  'contains_existing',
  'partial_overlap',
] as const

export type CourseSessionConflictRelation = (typeof COURSE_SESSION_CONFLICT_RELATIONS)[number]

export interface CourseSessionConflictItem {
  proposedSessionDate: string
  proposedStartTime: string
  proposedEndTime: string
  existingSessionId: string
  existingCourseId: string
  existingCourseTitle: string
  existingCourseShortTitle: string
  existingSessionTitle: string
  existingSessionDate: string
  existingStartTime: string
  existingEndTime: string
  existingStatus: 'scheduled' | 'completed'
  relation: CourseSessionConflictRelation
}

export interface CourseSessionConflictSummary {
  requestedCourseId: string
  totalCount: number
  conflicts: CourseSessionConflictItem[]
}

export class CourseSessionConflictError extends Error {
  readonly summary: CourseSessionConflictSummary

  constructor(summary: CourseSessionConflictSummary) {
    super('course_session_conflict')
    this.name = 'CourseSessionConflictError'
    this.summary = summary
  }
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^\d{2}:\d{2}$/

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().slice(0, maxLength)
  return cleaned || null
}

function cleanDate(value: unknown): string | null {
  const cleaned = cleanString(value, 10)
  return cleaned && datePattern.test(cleaned) ? cleaned : null
}

function cleanTime(value: unknown): string | null {
  const cleaned = cleanString(value, 5)
  return cleaned && timePattern.test(cleaned) ? cleaned : null
}

function normalizeConflict(value: unknown): CourseSessionConflictItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const proposedSessionDate = cleanDate(item.proposedSessionDate)
  const proposedStartTime = cleanTime(item.proposedStartTime)
  const proposedEndTime = cleanTime(item.proposedEndTime)
  const existingSessionId = cleanString(item.existingSessionId, 120)
  const existingCourseId = cleanString(item.existingCourseId, 120)
  const existingCourseTitle = cleanString(item.existingCourseTitle, 200)
  const existingCourseShortTitle = cleanString(item.existingCourseShortTitle, 120)
  const existingSessionTitle = cleanString(item.existingSessionTitle, 180)
  const existingSessionDate = cleanDate(item.existingSessionDate)
  const existingStartTime = cleanTime(item.existingStartTime)
  const existingEndTime = cleanTime(item.existingEndTime)
  const existingStatus = item.existingStatus === 'completed' ? 'completed' : item.existingStatus === 'scheduled' ? 'scheduled' : null
  const relation = COURSE_SESSION_CONFLICT_RELATIONS.includes(item.relation as CourseSessionConflictRelation)
    ? item.relation as CourseSessionConflictRelation
    : null

  if (!proposedSessionDate || !proposedStartTime || !proposedEndTime
    || !existingSessionId || !existingCourseId || !existingCourseTitle
    || !existingCourseShortTitle || !existingSessionTitle || !existingSessionDate
    || !existingStartTime || !existingEndTime || !existingStatus || !relation) return null

  return {
    proposedSessionDate,
    proposedStartTime,
    proposedEndTime,
    existingSessionId,
    existingCourseId,
    existingCourseTitle,
    existingCourseShortTitle,
    existingSessionTitle,
    existingSessionDate,
    existingStartTime,
    existingEndTime,
    existingStatus,
    relation,
  }
}

export function encodeCourseSessionConflictSummary(summary: CourseSessionConflictSummary): string {
  const payload: CourseSessionConflictSummary = {
    requestedCourseId: summary.requestedCourseId.slice(0, 120),
    totalCount: Math.max(summary.conflicts.length, Math.trunc(summary.totalCount)),
    conflicts: summary.conflicts.slice(0, 8),
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeCourseSessionConflictSummary(value: string | null | undefined): CourseSessionConflictSummary | null {
  if (!value || value.length > 16_000) return null

  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (!decoded || typeof decoded !== 'object') return null
    const payload = decoded as Record<string, unknown>
    const requestedCourseId = cleanString(payload.requestedCourseId, 120)
    const conflicts = Array.isArray(payload.conflicts)
      ? payload.conflicts.map(normalizeConflict).filter((item): item is CourseSessionConflictItem => Boolean(item)).slice(0, 8)
      : []
    if (!requestedCourseId || !conflicts.length) return null

    const requestedTotal = typeof payload.totalCount === 'number' && Number.isFinite(payload.totalCount)
      ? Math.trunc(payload.totalCount)
      : conflicts.length

    return {
      requestedCourseId,
      totalCount: Math.max(conflicts.length, requestedTotal),
      conflicts,
    }
  } catch {
    return null
  }
}

export function isCourseSessionConflictError(error: unknown): error is CourseSessionConflictError {
  return error instanceof CourseSessionConflictError
    || Boolean(error && typeof error === 'object' && (error as { name?: unknown }).name === 'CourseSessionConflictError'
      && (error as { summary?: unknown }).summary)
}
