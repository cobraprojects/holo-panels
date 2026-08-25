<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import { panelsPortalTarget } from "../../portal";

	let { to, ...restProps }: AlertDialogPrimitive.PortalProps = $props();
	const panelTarget = panelsPortalTarget();
	let target = $derived(to ?? panelTarget());
</script>

<AlertDialogPrimitive.Portal to={target} {...restProps} />
