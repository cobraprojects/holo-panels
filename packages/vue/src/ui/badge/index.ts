import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Badge } from "./Badge.vue"

export const badgeVariants = cva(
  'hp:inline-flex hp:items-center hp:justify-center hp:rounded-full hp:border hp:px-2 hp:py-0.5 hp:text-xs hp:font-medium hp:w-fit hp:whitespace-nowrap hp:shrink-0 hp:[&>svg]:size-3 hp:gap-1 hp:[&>svg]:pointer-events-none hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:focus-visible:ring-3 hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive hp:transition-[color,box-shadow] hp:overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'hp:border-transparent hp:bg-primary hp:text-primary-foreground hp:[a&]:hover:bg-primary/90',
        secondary:
          'hp:border-transparent hp:bg-secondary hp:text-secondary-foreground hp:[a&]:hover:bg-secondary/90',
        destructive:
         'hp:border-transparent hp:bg-destructive hp:text-white hp:[a&]:hover:bg-destructive/90 hp:focus-visible:ring-destructive/20 hp:dark:focus-visible:ring-destructive/40 hp:dark:bg-destructive/60',
        outline:
          'hp:text-foreground hp:[a&]:hover:bg-accent hp:[a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)
export type BadgeVariants = VariantProps<typeof badgeVariants>
