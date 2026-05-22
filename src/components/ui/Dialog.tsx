import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }
>(({ className, wide, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid -translate-x-1/2 -translate-y-1/2 gap-4 p-5 w-[92vw]',
        'bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-xl',
        'shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7),0_8px_16px_-4px_rgba(0,0,0,0.4)]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'overflow-hidden',
        wide ? 'max-w-3xl' : 'max-w-md',
        className,
      )}
      {...props}
    >
      {/* accent ribbon */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-70"
      />
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Title className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">
      {children}
    </DialogPrimitive.Title>
  )
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Description className="text-xs text-[var(--color-muted)] font-mono">
      {children}
    </DialogPrimitive.Description>
  )
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 pt-1 border-t border-[var(--color-border)] -mx-5 -mb-5 px-5 py-3 mt-1 bg-[color-mix(in_oklab,var(--color-surface-2)_70%,transparent)]">
      {children}
    </div>
  )
}
