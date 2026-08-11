interface RatingValueProperties {
  readonly label?: string
  readonly maximum?: number
  readonly value: number
}

interface FeatureActionProperties {
  readonly label?: string
  readonly pending?: boolean
}

interface RatingWidgetProperties {
  readonly average: number
  readonly count: number
  readonly maximum?: number
}

interface InsightsPageProperties {
  readonly featured: number
  readonly reviewed: number
}

function ratingText(properties: RatingValueProperties): string {
  const maximum = properties.maximum ?? 5
  const label = properties.label ?? 'Rating'
  return `${label}: ${properties.value.toFixed(1)} / ${maximum}`
}

export function RatingField(properties: RatingValueProperties): string {
  return ratingText(properties)
}

export function RatingColumn(properties: RatingValueProperties): string {
  return ratingText(properties)
}

export function RatingEntry(properties: RatingValueProperties): string {
  return ratingText(properties)
}

export function RatingFilter(properties: RatingValueProperties): string {
  return `Minimum ${ratingText(properties).toLowerCase()}`
}

export function FeatureAction(properties: FeatureActionProperties = {}): string {
  if (properties.pending) return 'Featuring…'
  return properties.label ?? 'Feature'
}

export function RatingWidget(properties: RatingWidgetProperties): string {
  return `Average rating: ${properties.average.toFixed(1)} / ${properties.maximum ?? 5} from ${properties.count} reviews`
}

export function InsightsPage(properties: InsightsPageProperties): string {
  return `Product insights: ${properties.featured} featured, ${properties.reviewed} reviewed`
}
