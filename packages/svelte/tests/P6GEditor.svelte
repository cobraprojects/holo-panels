<script lang="ts">
  import type { SvelteEditorProps } from '../src/fields/contracts'

  let { value, disabled, readOnly, label, inputId, setValue }: SvelteEditorProps = $props()
</script>

<textarea data-custom-editor aria-label={label} id={inputId} {disabled} readonly={readOnly} value={String(value)} oninput={(event) => setValue((event.currentTarget as HTMLTextAreaElement).value)}></textarea>
