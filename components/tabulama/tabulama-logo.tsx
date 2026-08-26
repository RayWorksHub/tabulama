import Image from 'next/image'
import { cn } from '@/lib/utils'

export function TabuLamaLogo({
  className,
  markSize = 44,
  variant = 'default',
}: {
  className?: string
  markSize?: number
  variant?: 'default' | 'light'
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <Image
        src="/tabulama/tabulama-mark.webp"
        alt="TabuLama Programozó Akadémia logó"
        width={markSize}
        height={markSize}
        className="shrink-0"
        priority
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-heading text-lg font-extrabold tracking-tight',
            variant === 'light' ? 'text-navy-foreground' : 'text-primary',
          )}
        >
          TabuLama
        </span>
        <span
          className={cn(
            'mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em]',
            variant === 'light'
              ? 'text-navy-foreground/70'
              : 'text-muted-foreground',
          )}
        >
          Programozó Akadémia
        </span>
      </span>
    </span>
  )
}
