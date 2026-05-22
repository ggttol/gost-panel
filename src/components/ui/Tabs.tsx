import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-4 border-b border-[var(--color-border)]',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative py-1.5 text-xs font-medium tracking-tight',
      'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
      'data-[state=active]:text-[var(--color-fg)]',
      'after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-transparent',
      'data-[state=active]:after:bg-[var(--color-accent)]',
      'transition-colors duration-100',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'
