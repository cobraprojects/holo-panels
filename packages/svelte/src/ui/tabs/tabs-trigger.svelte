<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.TriggerProps = $props();
</script>

<TabsPrimitive.Trigger
	bind:ref
	data-slot="tabs-trigger"
	class={cn(
		"hp:gap-1.5 hp:rounded-md hp:border hp:border-transparent hp:px-1.5 hp:py-0.5 hp:text-sm hp:font-medium hp:has-data-[icon=inline-end]:pr-1 hp:has-data-[icon=inline-start]:pl-1 hp:group-data-[variant=default]/tabs-list:data-active:shadow-sm hp:group-data-[variant=line]/tabs-list:data-active:shadow-none hp:[&_svg:not([class*='size-'])]:size-4 hp:relative hp:inline-flex hp:h-[calc(100%-1px)] hp:flex-1 hp:items-center hp:justify-center hp:whitespace-nowrap hp:text-foreground/60 hp:transition-all hp:group-data-[orientation=vertical]/tabs:w-full hp:group-data-[orientation=vertical]/tabs:justify-start hp:hover:text-foreground hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:focus-visible:outline-1 hp:focus-visible:outline-ring hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:dark:text-muted-foreground hp:dark:hover:text-foreground hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		"hp:group-data-[variant=line]/tabs-list:bg-transparent hp:group-data-[variant=line]/tabs-list:data-active:bg-transparent hp:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent hp:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
		"hp:data-active:bg-background hp:data-active:text-foreground hp:dark:data-active:border-input hp:dark:data-active:bg-input/30 hp:dark:data-active:text-foreground",
		"hp:after:absolute hp:after:bg-foreground hp:after:opacity-0 hp:after:transition-opacity hp:group-data-[orientation=horizontal]/tabs:after:inset-x-0 hp:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] hp:group-data-[orientation=horizontal]/tabs:after:h-0.5 hp:group-data-[orientation=vertical]/tabs:after:inset-y-0 hp:group-data-[orientation=vertical]/tabs:after:-right-1 hp:group-data-[orientation=vertical]/tabs:after:w-0.5 hp:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
		className
	)}
	{...restProps}
/>
