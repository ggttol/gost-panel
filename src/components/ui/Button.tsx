import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  asChild?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[color-mix(in_oklab,var(--color-fg)_88%,var(--color-accent))] active:translate-y-[0.5px] disabled:opacity-50',
  secondary:
    'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] active:translate-y-[0.5px] disabled:opacity-50',
  ghost:
    'text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:opacity-50',
  danger:
    'bg-[var(--color-danger)] text-white hover:brightness-110 active:translate-y-[0.5px] disabled:opacity-50',
  accent:
    'bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:brightness-105 active:translate-y-[0.5px] disabled:opacity-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs rounded-md',
  md: 'h-8 px-3 text-[13px] rounded-md',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref as React.Ref<HTMLButtonElement>}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium tracking-tight transition-[background-color,border-color,color,transform,opacity] duration-150 ease-out disabled:cursor-not-allowed select-none',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
