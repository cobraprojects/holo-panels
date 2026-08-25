import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as InputGroup } from './InputGroup.vue'
export { default as InputGroupAddon } from './InputGroupAddon.vue'
export { default as InputGroupInput } from './InputGroupInput.vue'
export { default as InputGroupText } from './InputGroupText.vue'

export const inputGroupAddonVariants = cva(
  'hp:flex hp:h-auto hp:cursor-text hp:items-center hp:justify-center hp:gap-2 hp:py-1.5 hp:text-sm hp:font-medium hp:text-muted-foreground hp:select-none hp:[&>svg:not([class*=size-])]:size-4 hp:[&>kbd]:rounded-[calc(var(--radius)-5px)] hp:group-data-[disabled=true]/input-group:opacity-50',
  {
    variants: {
      align: {
        'inline-start': 'hp:order-first hp:pl-3',
        'inline-end': 'hp:order-last hp:pr-3',
        'block-start': 'hp:order-first hp:w-full hp:justify-start hp:px-3 hp:pt-3',
        'block-end': 'hp:order-last hp:w-full hp:justify-start hp:px-3 hp:pb-3',
      },
    },
    defaultVariants: { align: 'inline-start' },
  },
)

export type InputGroupVariants = VariantProps<typeof inputGroupAddonVariants>
