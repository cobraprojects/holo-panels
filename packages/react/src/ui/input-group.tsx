'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { Button } from './button'
import { Input } from './input'
import { Textarea } from './textarea'

function InputGroup({ className, ...props }: React.ComponentProps<'div'>): React.ReactNode {
  return <div
    className={cn(
      'hp:group/input-group hp:relative hp:flex hp:h-9 hp:w-full hp:min-w-0 hp:items-center hp:rounded-md hp:border hp:border-input hp:shadow-xs hp:outline-none hp:transition-[color,box-shadow] hp:has-[>textarea]:h-auto hp:dark:bg-input/30',
      'hp:has-[>[data-align=inline-start]]:[&>input]:pl-2 hp:has-[>[data-align=inline-end]]:[&>input]:pr-2',
      'hp:has-[>[data-align=block-start]]:h-auto hp:has-[>[data-align=block-start]]:flex-col hp:has-[>[data-align=block-start]]:[&>input]:pb-3',
      'hp:has-[>[data-align=block-end]]:h-auto hp:has-[>[data-align=block-end]]:flex-col hp:has-[>[data-align=block-end]]:[&>input]:pt-3',
      'hp:has-[[data-slot=input-group-control]:focus-visible]:border-ring hp:has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] hp:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50',
      'hp:has-[[data-slot][aria-invalid=true]]:border-destructive hp:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 hp:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',
      className,
    )}
    data-slot="input-group"
    role="group"
    {...props}
  />
}

const inputGroupAddonVariants = cva(
  'hp:flex hp:h-auto hp:cursor-text hp:items-center hp:justify-center hp:gap-2 hp:py-1.5 hp:text-sm hp:font-medium hp:text-muted-foreground hp:select-none hp:group-data-[disabled=true]/input-group:opacity-50 hp:[&>kbd]:rounded-[calc(var(--radius)-5px)] hp:[&>svg:not([class*=size-])]:size-4',
  {
    variants: {
      align: {
        'inline-start': 'hp:order-first hp:pl-3 hp:has-[>button]:ml-[-0.45rem] hp:has-[>kbd]:ml-[-0.35rem]',
        'inline-end': 'hp:order-last hp:pr-3 hp:has-[>button]:mr-[-0.45rem] hp:has-[>kbd]:mr-[-0.35rem]',
        'block-start': 'hp:order-first hp:w-full hp:justify-start hp:px-3 hp:pt-3 hp:group-has-[>input]/input-group:pt-2.5 hp:[.border-b]:pb-3',
        'block-end': 'hp:order-last hp:w-full hp:justify-start hp:px-3 hp:pb-3 hp:group-has-[>input]/input-group:pb-2.5 hp:[.border-t]:pt-3',
      },
    },
    defaultVariants: { align: 'inline-start' },
  },
)

function InputGroupAddon({ className, align = 'inline-start', onClick, ...props }: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>): React.ReactNode {
  return <div
    className={cn(inputGroupAddonVariants({ align }), className)}
    data-align={align}
    data-slot="input-group-addon"
    onClick={event => {
      onClick?.(event)
      if (!event.defaultPrevented && !(event.target as HTMLElement).closest('button')) event.currentTarget.parentElement?.querySelector('input')?.focus()
    }}
    role="group"
    {...props}
  />
}

const inputGroupButtonVariants = cva('hp:flex hp:items-center hp:gap-2 hp:text-sm hp:shadow-none', {
  variants: {
    size: {
      xs: 'hp:h-6 hp:gap-1 hp:rounded-[calc(var(--radius)-5px)] hp:px-2 hp:has-[>svg]:px-2 hp:[&>svg:not([class*=size-])]:size-3.5',
      sm: 'hp:h-8 hp:gap-1.5 hp:rounded-md hp:px-2.5 hp:has-[>svg]:px-2.5',
      'icon-xs': 'hp:size-6 hp:rounded-[calc(var(--radius)-5px)] hp:p-0 hp:has-[>svg]:p-0',
      'icon-sm': 'hp:size-8 hp:p-0 hp:has-[>svg]:p-0',
    },
  },
  defaultVariants: { size: 'xs' },
})

function InputGroupButton({ className, type = 'button', variant = 'ghost', size = 'xs', ...props }: Omit<React.ComponentProps<typeof Button>, 'size'> & VariantProps<typeof inputGroupButtonVariants>): React.ReactNode {
  return <Button className={cn(inputGroupButtonVariants({ size }), className)} data-size={size} type={type} variant={variant} {...props} />
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>): React.ReactNode {
  return <span className={cn('hp:flex hp:items-center hp:gap-2 hp:text-sm hp:text-muted-foreground hp:[&_svg]:pointer-events-none hp:[&_svg:not([class*=size-])]:size-4', className)} {...props} />
}

function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>): React.ReactNode {
  return <Input className={cn('hp:flex-1 hp:rounded-none hp:border-0 hp:bg-transparent hp:shadow-none hp:focus-visible:ring-0 hp:dark:bg-transparent', className)} data-slot="input-group-control" {...props} />
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<'textarea'>): React.ReactNode {
  return <Textarea className={cn('hp:flex-1 hp:resize-none hp:rounded-none hp:border-0 hp:bg-transparent hp:py-3 hp:shadow-none hp:focus-visible:ring-0 hp:dark:bg-transparent', className)} data-slot="input-group-control" {...props} />
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea }
