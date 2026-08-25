import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export const fieldVariants = cva(
  'hp:group/field hp:flex hp:w-full hp:gap-3 hp:data-[invalid=true]:text-destructive',
  {
    variants: {
      orientation: {
        vertical: ['hp:flex-col hp:[&>*]:w-full hp:[&>.sr-only]:w-auto'],
        horizontal: [
          'hp:flex-row hp:items-center',
          'hp:[&>[data-slot=field-label]]:flex-auto',
          'hp:has-[>[data-slot=field-content]]:items-start hp:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
        ],
        responsive: [
          'hp:flex-col hp:[&>*]:w-full hp:[&>.sr-only]:w-auto hp:@md/field-group:flex-row hp:@md/field-group:items-center hp:@md/field-group:[&>*]:w-auto',
          'hp:@md/field-group:[&>[data-slot=field-label]]:flex-auto',
          'hp:@md/field-group:has-[>[data-slot=field-content]]:items-start hp:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  },
)

export type FieldVariants = VariantProps<typeof fieldVariants>

export { default as Field } from "./Field.vue"
export { default as FieldContent } from "./FieldContent.vue"
export { default as FieldDescription } from "./FieldDescription.vue"
export { default as FieldError } from "./FieldError.vue"
export { default as FieldGroup } from "./FieldGroup.vue"
export { default as FieldLabel } from "./FieldLabel.vue"
export { default as FieldLegend } from "./FieldLegend.vue"
export { default as FieldSeparator } from "./FieldSeparator.vue"
export { default as FieldSet } from "./FieldSet.vue"
export { default as FieldTitle } from "./FieldTitle.vue"
