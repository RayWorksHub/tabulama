'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createTestApplication } from '@/lib/application-repository'

export async function createTestApplicationAction(): Promise<void> {
  await requireAdmin('/admin/jelentkezok')

  let applicationId: string
  try {
    applicationId = await createTestApplication()
  } catch {
    console.error('[TabuLama] A TESZT jelentkezés nem hozható létre.')
    redirect('/admin/jelentkezok?error=test_create_failed')
  }

  revalidatePath('/admin')
  revalidatePath('/admin/jelentkezok')
  redirect(`/admin/jelentkezok/${encodeURIComponent(applicationId)}?success=test_created`)
}
