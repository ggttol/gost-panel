import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-8 px-2.5 text-[13px] rounded-md',
        'border border-[var(--color-border)] bg-[var(--color-surface)]',
        'outline-none placeholder:text-[var(--color-muted)]',
        'transition-[border-color,box-shadow] duration-100',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow">
      {children}
    </label>
  )
}
