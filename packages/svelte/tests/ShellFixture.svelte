<script lang="ts">
  import {
    PanelsAvatar,
    PanelsBadge,
    PanelsButton,
    PanelsDropdown,
    PanelsEmptyState,
    PanelsErrorBoundary,
    PanelsIconButton,
    PanelsInputWrapper,
    PanelsLink,
    PanelsLoadingIndicator,
    PanelsModal,
    PanelsPagination,
    PanelsSection,
    PanelsSlideOver,
    PanelsTabs,
    PanelsToastViewport,
  } from '../src/components'

  interface Props { onselect?: (id: string) => void }
  let { onselect }: Props = $props()
</script>

<PanelsButton />
<PanelsLink href="/posts" />
<PanelsBadge />
<PanelsAvatar alt="Ada Lovelace" fallback="AL" />
<PanelsIconButton label="Open navigation" />
<PanelsInputWrapper description="Public title" error="Required" inputId="title" label="Title" />
<PanelsLoadingIndicator label="Loading posts" />
<PanelsDropdown items={[{ id: 'edit', label: 'Edit' }, { id: 'delete', label: 'Delete' }]} label="Actions" {onselect} />
<PanelsModal labelledBy="modal-title" onclose={() => undefined} open={true} />
<PanelsSlideOver labelledBy="drawer-title" onclose={() => undefined} open={true} />
<PanelsTabs label="Content" tabs={[{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }]} value="one" />
<PanelsSection heading="Details" />
<PanelsEmptyState heading="Nothing here" />
<PanelsPagination page={2} pages={5} />
<PanelsToastViewport toasts={[{ id: 'saved', message: 'Saved', tone: 'success' }]} />
<PanelsErrorBoundary error="Renderer failed" />
