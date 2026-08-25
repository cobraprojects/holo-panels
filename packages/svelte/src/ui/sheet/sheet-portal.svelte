<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";
	import { panelsPortalTarget } from "../../portal";

	let { to, ...restProps }: SheetPrimitive.PortalProps = $props();
	const panelTarget = panelsPortalTarget();
	let target = $derived(to ?? panelTarget());
</script>

<SheetPrimitive.Portal to={target} {...restProps} />
