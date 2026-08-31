import type {
  ClientActionManifest,
  ClientActionStore,
  CustomWidgetData,
  TableWidgetData,
  WidgetClientManifest,
  WidgetStore,
  WidgetTableController,
} from '@holo-js/panels-client'
import type { ComponentRegistry } from '../registry'
import type { ReactNode } from 'react'

export interface ReactWidgetManifest extends WidgetClientManifest {
  readonly description: string | null
  readonly emptyState: string
  readonly errorState: string
  readonly family: 'chart' | 'custom' | 'stats' | 'table'
  readonly heading: string | null
  readonly sort: number
  readonly type: string
}

export interface ReactCustomWidgetProps {
  readonly properties: CustomWidgetData['properties']
  readonly widget: ReactWidgetManifest
}

export interface ReactTableWidgetProps {
  readonly data: TableWidgetData
  readonly widget: ReactWidgetManifest
}

export interface ReactWidgetRendererProps {
  readonly table?: WidgetTableController
  readonly actions?: readonly ClientActionManifest[]
  readonly actionStore?: ClientActionStore<unknown>
  readonly action?: (action: string) => void | Promise<void>
  readonly manifest: ReactWidgetManifest
  readonly navigate?: (url: string) => void
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly renderTable?: (props: ReactTableWidgetProps) => ReactNode
  readonly store: WidgetStore
}

export interface ReactDashboardWidget {
  readonly manifest: ReactWidgetManifest
  readonly render: () => ReactNode
}

export interface ReactDashboardRendererProps {
  readonly label: string
  readonly widgets: readonly ReactDashboardWidget[]
  readonly width: number
}

export interface ReactResourceWidget extends ReactDashboardWidget {
  readonly placement: 'footer' | 'header'
}

export interface ReactResourceWidgetsProps {
  readonly children: ReactNode
  readonly footerLabel?: string
  readonly headerLabel?: string
  readonly widgets: readonly ReactResourceWidget[]
  readonly width: number
}
