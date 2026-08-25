<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { panelsPortalTarget } from "../../portal";

	let { to, ...restProps }: DialogPrimitive.PortalProps = $props();
	const panelTarget = panelsPortalTarget();
	let target = $derived(to ?? panelTarget());
</script>

<DialogPrimitive.Portal to={target} {...restProps} />
