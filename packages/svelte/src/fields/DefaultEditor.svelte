<script lang="ts">
  import { Textarea } from '../ui/textarea'
  import type { SvelteEditorProps } from './contracts'

  let { value, disabled, readOnly, label, inputId, describedBy, errorMessageId, invalid, setValue }: SvelteEditorProps = $props()

  function update(event: Event): void {
    setValue((event.currentTarget as HTMLTextAreaElement).value)
  }
</script>

<Textarea
  id={inputId}
  aria-label={label}
  aria-describedby={describedBy}
  aria-errormessage={errorMessageId}
  aria-invalid={invalid || undefined}
  {disabled}
  readonly={readOnly}
  value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
  oninput={update}
></Textarea>
