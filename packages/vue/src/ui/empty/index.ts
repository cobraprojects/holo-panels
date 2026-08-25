import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Empty } from "./Empty.vue"
export { default as EmptyContent } from "./EmptyContent.vue"
export { default as EmptyDescription } from "./EmptyDescription.vue"
export { default as EmptyHeader } from "./EmptyHeader.vue"
export { default as EmptyMedia } from "./EmptyMedia.vue"
export { default as EmptyTitle } from "./EmptyTitle.vue"

export const emptyMediaVariants = cva(
  'hp:mb-2 hp:flex hp:shrink-0 hp:items-center hp:justify-center hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hp:bg-transparent',
        icon: 'hp:bg-muted hp:text-foreground hp:flex hp:size-10 hp:shrink-0 hp:items-center hp:justify-center hp:rounded-lg hp:[&_svg:not([class*=\'size-\'])]:size-6',
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export type EmptyMediaVariants = VariantProps<typeof emptyMediaVariants>
