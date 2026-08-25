import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Alert } from "./Alert.vue"
export { default as AlertDescription } from "./AlertDescription.vue"
export { default as AlertTitle } from "./AlertTitle.vue"

export const alertVariants = cva(
  'hp:relative hp:w-full hp:rounded-lg hp:border hp:px-4 hp:py-3 hp:text-sm hp:grid hp:has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] hp:grid-cols-[0_1fr] hp:has-[>svg]:gap-x-3 hp:gap-y-0.5 hp:items-start hp:[&>svg]:size-4 hp:[&>svg]:translate-y-0.5 hp:[&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'hp:bg-card hp:text-card-foreground',
        destructive:
          'hp:text-destructive hp:bg-card hp:[&>svg]:text-current hp:*:data-[slot=alert-description]:text-destructive/90',
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export type AlertVariants = VariantProps<typeof alertVariants>
