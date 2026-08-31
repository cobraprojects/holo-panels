import type { ReactCustomWidgetProps } from '@holo-js/panels-react'

export default function ContentNotice({ properties }: ReactCustomWidgetProps) {
  return <div><p>{String(properties.message ?? '')}</p><details><summary>Publishing details</summary><p>{String(properties.detail ?? '')}</p></details></div>
}
