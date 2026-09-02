import Image from 'next/image'
import Link from 'next/link'
import { BookOpenCheck, ExternalLink, Grid3X3 } from 'lucide-react'

export function StudentWorkspaceChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="tl-workspace tl-student-workspace">
      <header className="tl-workspace-appbar">
        <Link href="/portal" className="tl-workspace-brand" aria-label="TabuLama tanulói kezdőlap">
          <span className="tl-workspace-launcher" aria-hidden="true">
            <Grid3X3 className="h-4 w-4" />
          </span>
          <Image
            src="/tabulama/tabulama-mark.webp"
            alt=""
            width={28}
            height={28}
            priority
            className="tl-workspace-logo"
          />
          <span className="tl-workspace-product">TabuLama</span>
          <span className="tl-workspace-divider" aria-hidden="true" />
          <span className="tl-workspace-area">Tanulói központ</span>
        </Link>

        <p className="tl-workspace-context">
          <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          Saját kurzusok és haladás
        </p>

        <Link href="/kurzusok" className="tl-workspace-public-link">
          Kurzusok megtekintése
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      <div className="tl-student-workspace-canvas">{children}</div>
    </div>
  )
}
