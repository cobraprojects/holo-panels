'use client'

import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { cn } from '../lib/utils'

function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.Root>): React.ReactNode {
  return <ScrollAreaPrimitive.Root className={cn('hp:relative', className)} data-slot="scroll-area" {...props}>
    <ScrollAreaPrimitive.Viewport className="hp:size-full hp:rounded-[inherit] hp:outline-none hp:transition-[color,box-shadow] hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:focus-visible:outline-1" data-slot="scroll-area-viewport">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
}

function ScrollBar({ className, orientation = 'vertical', ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>): React.ReactNode {
  return <ScrollAreaPrimitive.ScrollAreaScrollbar
    className={cn('hp:flex hp:touch-none hp:p-px hp:transition-colors hp:select-none', orientation === 'vertical' ? 'hp:h-full hp:w-2.5 hp:border-l hp:border-l-transparent' : 'hp:h-2.5 hp:flex-col hp:border-t hp:border-t-transparent', className)}
    data-slot="scroll-area-scrollbar"
    orientation={orientation}
    {...props}
  ><ScrollAreaPrimitive.ScrollAreaThumb className="hp:relative hp:flex-1 hp:rounded-full hp:bg-border" data-slot="scroll-area-thumb" /></ScrollAreaPrimitive.ScrollAreaScrollbar>
}

export { ScrollArea, ScrollBar }
