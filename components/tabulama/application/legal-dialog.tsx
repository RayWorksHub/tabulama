'use client'

import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface LegalDialogProps {
  title: string
  triggerLabel: string
  /** Ha van valódi, publikus URL, azt is felkínáljuk új lapon. */
  externalUrl?: string | null
  children: ReactNode
}

/**
 * Billentyűzettel is kezelhető, fókuszcsapdás jogi dialog (base-ui).
 * A teljes szöveg itt olvasható; ha van valódi URL, külön link nyílik új lapon.
 */
export function LegalDialog({ title, triggerLabel, externalUrl, children }: LegalDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="rounded font-semibold text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {triggerLabel}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl focus:outline-none data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 transition-all">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <Dialog.Title className="font-heading text-lg font-bold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Bezárás"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground">
            {children}
            {externalUrl ? (
              <p className="mt-4">
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  Megnyitás új lapon
                </a>
              </p>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
