'use client'

import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '../lib/utils'

function Progress({ className, max = 100, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>): React.ReactNode {
  const maximum = max > 0 ? max : 100
  const percentage = Math.max(0, Math.min(100, ((value ?? 0) / maximum) * 100))
  return <ProgressPrimitive.Root className={cn('hp:relative hp:h-2 hp:w-full hp:overflow-hidden hp:rounded-full hp:bg-primary/20', className)} data-slot="progress" max={maximum} value={value} {...props}>
    <ProgressPrimitive.Indicator className="hp:h-full hp:w-full hp:flex-1 hp:bg-primary hp:transition-all" data-slot="progress-indicator" style={{ transform: `translateX(-${100 - percentage}%)` }} />
  </ProgressPrimitive.Root>
}

export { Progress }
