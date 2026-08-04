<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import type { SchemaComponentManifest } from '@holo-js/panels-client'
  import type { SchemaRendererContext } from './contracts'
  import { componentClass, contentId, layoutAttributes, persistenceKey, resolveRegisteredComponent, safeDomAttributes } from './helpers'
  import SchemaChildren from './SchemaChildren.svelte'
  import SchemaSlot from './SchemaSlot.svelte'

  let {
    component,
    context,
  }: {
    readonly component: SchemaComponentManifest
    readonly context: SchemaRendererContext
  } = $props()

  const attributes = $derived({ ...safeDomAttributes(component.extraAttributes), ...layoutAttributes(component) })
  const className = $derived(componentClass(component))
  const headingId = $derived(contentId(context.schemaId, component.id, 'heading'))
  const contentRegionId = $derived(contentId(context.schemaId, component.id, 'content'))
  const visibleChildren = $derived(component.children.filter(child => child.visible))
  const leaf = $derived(component.kind === 'entry' || component.kind === 'filter' || component.kind === 'widget')
  const tabs = $derived(visibleChildren.filter(child => child.kind === 'tab'))
  const steps = $derived(visibleChildren.filter(child => child.kind === 'step'))
  let selectedTab = $state(0)
  let selectedStep = $state(0)
  let collapsed = $state(untrack(() => component.properties.collapse?.collapsed ?? false))

  const Custom = $derived(component.kind === 'custom'
    ? resolveRegisteredComponent(context, component.properties.customType ?? component.type, `custom schema component "${component.id}"`)
    : undefined)

  onMount(() => {
    const key = persistenceKey(context.schemaId, component)
    if (!key) return
    try {
      const stored = localStorage.getItem(key)
      if (component.kind === 'tabs' && stored !== null) selectedTab = boundedIndex(stored, tabs.length)
      if (component.kind === 'wizard' && stored !== null) selectedStep = boundedIndex(stored, steps.length)
      if (component.properties.collapse?.collapsible && stored !== null) collapsed = stored === 'true'
    } catch {
      return
    }
  })

  function setCollapsed(value: boolean): void {
    collapsed = value
    persist(String(value))
  }

  function selectTab(index: number): void {
    selectedTab = index
    persist(String(index))
  }

  function selectStep(index: number): void {
    selectedStep = index
    persist(String(index))
  }

  function persist(value: string): void {
    const key = persistenceKey(context.schemaId, component)
    if (!key) return
    try {
      localStorage.setItem(key, value)
    } catch {
      return
    }
  }

  function boundedIndex(value: string, length: number): number {
    const index = Number.parseInt(value, 10)
    return Number.isInteger(index) && index >= 0 && index < length ? index : 0
  }

</script>

{#if component.visible}
  <SchemaSlot {context} ownerId={component.id} slots={component.slots.above} statePath={component.statePath} />
  <SchemaSlot {context} ownerId={component.id} slots={component.slots.before} statePath={component.statePath} />
  {#if !leaf}{@render context.renderContent?.({ component, panelId: context.panelId, schema: context.schema })}{/if}
  {#if component.kind === 'grid'}
    <div {...attributes} class={className}>
      <SchemaChildren components={visibleChildren} {context} />
    </div>
  {:else if component.kind === 'section'}
    <section {...attributes} aria-labelledby={component.properties.heading ? headingId : undefined} class={className}>
      {#if component.properties.heading}<h2 id={headingId}>{component.properties.heading}</h2>{/if}
      {#if component.properties.description}<p>{component.properties.description}</p>{/if}
      {#if component.properties.collapse?.collapsible}
        <button aria-controls={contentRegionId} aria-expanded={!collapsed} onclick={() => setCollapsed(!collapsed)} type="button">
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      {/if}
      <div hidden={collapsed} id={contentRegionId}>
        <SchemaChildren components={visibleChildren} {context} />
      </div>
    </section>
  {:else if component.kind === 'group'}
    <div {...attributes} class={className} role="group">
      {#if component.properties.collapse?.collapsible}
        <button aria-controls={contentRegionId} aria-expanded={!collapsed} onclick={() => setCollapsed(!collapsed)} type="button">
          {collapsed ? 'Expand group' : 'Collapse group'}
        </button>
      {/if}
      <div hidden={collapsed} id={contentRegionId}>
        <SchemaChildren components={visibleChildren} {context} />
      </div>
    </div>
  {:else if component.kind === 'fieldset'}
    <fieldset {...attributes} class={className}>
      {#if component.properties.label}<legend>{component.properties.label}</legend>{/if}
      {#if component.properties.collapse?.collapsible}
        <button aria-controls={contentRegionId} aria-expanded={!collapsed} onclick={() => setCollapsed(!collapsed)} type="button">
          {collapsed ? 'Expand fields' : 'Collapse fields'}
        </button>
      {/if}
      <div hidden={collapsed} id={contentRegionId}>
        <SchemaChildren components={visibleChildren} {context} />
      </div>
    </fieldset>
  {:else if component.kind === 'tabs'}
    <div {...attributes} class={className}>
      <div aria-label={component.properties.label ?? 'Sections'} role="tablist">
        {#each tabs as tab, index (tab.key)}
          <button
            aria-controls={contentId(context.schemaId, tab.id, 'panel')}
            aria-selected={selectedTab === index}
            id={contentId(context.schemaId, tab.id, 'tab')}
            onclick={() => selectTab(index)}
            role="tab"
            tabindex={selectedTab === index ? 0 : -1}
            type="button"
          >{tab.properties.label ?? tab.properties.heading ?? `Tab ${index + 1}`}</button>
        {/each}
      </div>
      {#each tabs as tab, index (tab.key)}
        <div
          aria-labelledby={contentId(context.schemaId, tab.id, 'tab')}
          hidden={selectedTab !== index}
          id={contentId(context.schemaId, tab.id, 'panel')}
          role="tabpanel"
          tabindex="0"
        >
          <SchemaChildren components={[tab]} {context} />
        </div>
      {/each}
    </div>
  {:else if component.kind === 'wizard'}
    <div {...attributes} class={className}>
      <ol aria-label={component.properties.label ?? 'Progress'}>
        {#each steps as step, index (step.key)}
          <li aria-current={selectedStep === index ? 'step' : undefined}>
            <button disabled={index > selectedStep} onclick={() => selectStep(index)} type="button">
              {step.properties.label ?? step.properties.heading ?? `Step ${index + 1}`}
            </button>
          </li>
        {/each}
      </ol>
      {#each steps as step, index (step.key)}
        {#if selectedStep === index}
          <SchemaChildren components={[step]} {context} />
        {/if}
      {/each}
      <button disabled={selectedStep === 0} onclick={() => selectStep(selectedStep - 1)} type="button">Previous</button>
      <button disabled={selectedStep >= steps.length - 1} onclick={() => selectStep(selectedStep + 1)} type="button">Next</button>
    </div>
  {:else if component.kind === 'split'}
    <div {...attributes} class={className} data-split-from={component.properties.splitFrom}>
      <SchemaChildren components={visibleChildren} {context} />
    </div>
  {:else if component.kind === 'callout'}
    <aside {...attributes} aria-labelledby={component.properties.heading ? headingId : undefined} class={className} data-color={component.properties.color}>
      {#if component.properties.icon}<span aria-hidden="true" data-icon={component.properties.icon}></span>{/if}
      {#if component.properties.heading}<h2 id={headingId}>{component.properties.heading}</h2>{/if}
      {#if component.properties.description}<p>{component.properties.description}</p>{/if}
    </aside>
  {:else if component.kind === 'empty-state'}
    <section {...attributes} aria-labelledby={component.properties.heading ? headingId : undefined} class={className}>
      {#if component.properties.icon}<span aria-hidden="true" data-icon={component.properties.icon}></span>{/if}
      {#if component.properties.heading}<h2 id={headingId}>{component.properties.heading}</h2>{/if}
      {#if component.properties.description}<p>{component.properties.description}</p>{/if}
    </section>
  {:else if component.kind === 'custom' && Custom}
    <div {...attributes} class={className}>
      <Custom
        {...component.properties.customProperties}
        schemaComponentId={component.id}
        schemaStatePath={component.statePath}
      />
    </div>
  {:else if component.kind === 'tab'}
    <div {...attributes} class={className}>
      <SchemaChildren components={visibleChildren} {context} />
    </div>
  {:else if component.kind === 'step'}
    <section {...attributes} aria-labelledby={headingId} class={className}>
      <h2 id={headingId}>{component.properties.label ?? component.properties.heading ?? 'Step'}</h2>
      {#if component.properties.description}<p>{component.properties.description}</p>{/if}
      <SchemaChildren components={visibleChildren} {context} />
    </section>
  {:else if leaf}
    <div {...attributes} class={className} data-schema-leaf={component.kind}>
      {@render context.renderContent?.({ component, panelId: context.panelId, schema: context.schema })}
    </div>
  {/if}
  <SchemaSlot {context} ownerId={component.id} slots={component.slots.after} statePath={component.statePath} />
  <SchemaSlot {context} ownerId={component.id} slots={component.slots.below} statePath={component.statePath} />
{/if}
