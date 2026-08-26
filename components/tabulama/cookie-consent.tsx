'use client'

import { useEffect, useState } from 'react'
import { legalDocuments } from '@/lib/tabulama-config'

const STORAGE_KEY = 'tabulama-cookie-consent'

/**
 * Alul megjelenő adatkezelési / süti sáv. Munkamenetenként egyszer jelenik
 * meg (sessionStorage), a döntés után a munkamenet alatt nem tér vissza.
 * Az adatkezelési tájékoztatóra csak akkor linkel, ha a config-ban be van
 * állítva az URL – amíg `null`, addig jelezzük, hogy hamarosan elérhető.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const privacyUrl = legalDocuments.privacyPolicy.url

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) !== 'done') {
        setVisible(true)
      }
    } catch {
      // Ha a sessionStorage nem elérhető, inkább megmutatjuk a sávot.
      setVisible(true)
    }
  }, [])

  function dismiss() {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'done')
    } catch {
      // A tárolás hibája nem akadályozza a bezárást.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Adatkezelési tájékoztatás"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Az oldal a működéséhez szükséges sütiket használ, és a jelentkezéskor
          megadott adatokat a képzésre való felvétel céljából kezeljük.
          Részletek az{' '}
          {privacyUrl ? (
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
            >
              adatkezelési tájékoztatóban
            </a>
          ) : (
            <span className="font-semibold text-foreground">
              adatkezelési tájékoztatóban (hamarosan elérhető)
            </span>
          )}
          .
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Rendben
          </button>
        </div>
      </div>
    </div>
  )
}
