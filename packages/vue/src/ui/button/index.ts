import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

export const buttonVariants = cva(
  'hp:inline-flex hp:items-center hp:justify-center hp:gap-2 hp:whitespace-nowrap hp:rounded-md hp:text-sm hp:font-medium hp:transition-all hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg:not([class*=\'size-\'])]:size-4 hp:shrink-0 hp:[&_svg]:shrink-0 hp:outline-none hp:focus-visible:border-ring hp:focus-visible:ring-ring/50 hp:focus-visible:ring-3 hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default:
          'hp:bg-primary hp:text-primary-foreground hp:hover:bg-primary/90',
        destructive:
          'hp:bg-destructive hp:text-white hp:hover:bg-destructive/90 hp:focus-visible:ring-destructive/20 hp:dark:focus-visible:ring-destructive/40 hp:dark:bg-destructive/60',
        outline:
          'hp:border hp:bg-background hp:shadow-xs hp:hover:bg-accent hp:hover:text-accent-foreground hp:dark:bg-input/30 hp:dark:border-input hp:dark:hover:bg-input/50',
        secondary:
          'hp:bg-secondary hp:text-secondary-foreground hp:hover:bg-secondary/80',
        ghost:
          'hp:hover:bg-accent hp:hover:text-accent-foreground hp:dark:hover:bg-accent/50',
        link: 'hp:text-primary hp:underline-offset-4 hp:hover:underline',
      },
      size: {
        "default": 'hp:h-9 hp:px-4 hp:py-2 hp:has-[>svg]:px-3',
        "xs": 'hp:h-6 hp:gap-1 hp:rounded-md hp:px-2 hp:text-xs hp:has-[>svg]:px-1.5 hp:[&_svg:not([class*=\'size-\'])]:size-3',
        "sm": 'hp:h-8 hp:rounded-md hp:gap-1.5 hp:px-3 hp:has-[>svg]:px-2.5',
        "lg": 'hp:h-10 hp:rounded-md hp:px-6 hp:has-[>svg]:px-4',
        "icon": 'hp:size-9',
        "icon-xs": 'hp:size-6 hp:rounded-md hp:[&_svg:not([class*=\'size-\'])]:size-3',
        "icon-sm": 'hp:size-8',
        "icon-lg": 'hp:size-10',
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
