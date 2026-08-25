<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { panelsPortalTarget } from "../../portal";

	let { to, ...restProps }: SelectPrimitive.PortalProps = $props();
	const panelTarget = panelsPortalTarget();
	let target = $derived(to ?? panelTarget());
</script>

<SelectPrimitive.Portal to={target} {...restProps} />
