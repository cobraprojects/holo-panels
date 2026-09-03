<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
	import { usePanelDirection } from '../../localization'
	const direction = usePanelDirection()

	let { open = $bindable(false), ...restProps }: DropdownMenuPrimitive.RootProps = $props();
</script>

<DropdownMenuPrimitive.Root bind:open dir={direction()} {...restProps} />
