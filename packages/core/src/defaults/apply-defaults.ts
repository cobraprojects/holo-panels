import type { ComponentDefault, DefaultableComponentKind } from './component-default'

export interface ComponentDefaultLayers {
  readonly application?: readonly ComponentDefault[]
  readonly panel?: readonly ComponentDefault[]
  readonly plugins?: readonly (readonly ComponentDefault[])[]
}

export interface ApplyComponentDefaultsOptions<TBuilder extends object> extends ComponentDefaultLayers {
  readonly builder: TBuilder
  readonly compiled?: boolean | (() => boolean)
  readonly kind: DefaultableComponentKind
  readonly type: string
}

export interface CapturedComponentDefaults {
  readonly layers: ComponentDefaultLayers
  readonly kind: DefaultableComponentKind
  readonly type: string
}

const appliedBuilders = new WeakSet<object>()
const activeLayers: ComponentDefaultLayers[] = []

function isCompiled<TBuilder extends object>(options: ApplyComponentDefaultsOptions<TBuilder>): boolean {
  return typeof options.compiled === 'function' ? options.compiled() : options.compiled === true
}

function matchingDefaults(
  defaults: readonly ComponentDefault[] | undefined,
  kind: DefaultableComponentKind,
  type: string,
): readonly ComponentDefault[] {
  return Object.freeze((defaults ?? []).filter(value => value.kind === kind && value.type === type))
}

export function applyComponentDefaults<TBuilder extends object>(
  options: ApplyComponentDefaultsOptions<TBuilder>,
): TBuilder {
  if (isCompiled(options)) throw new Error('Component defaults cannot be applied after compilation')
  if (appliedBuilders.has(options.builder)) throw new Error('Component defaults can only be applied once')

  appliedBuilders.add(options.builder)
  const layers = [
    matchingDefaults(options.application, options.kind, options.type),
    ...(options.plugins ?? []).map(defaults => matchingDefaults(defaults, options.kind, options.type)),
    matchingDefaults(options.panel, options.kind, options.type),
  ]
  let builder: object = options.builder
  const prototype = Object.getPrototypeOf(options.builder)

  for (const defaults of layers) {
    for (const value of defaults) {
      builder = value.apply(builder)
      if (Object.getPrototypeOf(builder) !== prototype) {
        throw new TypeError('Component defaults must preserve the concrete builder subtype')
      }
    }
  }

  return builder as TBuilder
}

export function captureComponentDefaults(
  kind: DefaultableComponentKind,
  type: string,
): CapturedComponentDefaults | undefined {
  const layers = activeLayers.at(-1)
  return layers ? Object.freeze({ kind, layers, type }) : undefined
}

export function applyCapturedComponentDefaults<TBuilder extends object>(
  captured: CapturedComponentDefaults | undefined,
  builder: TBuilder,
  compiled = false,
): TBuilder {
  if (!captured) return builder
  return applyComponentDefaults({ ...captured.layers, builder, compiled, kind: captured.kind, type: captured.type })
}

export async function withComponentDefaults<TResult>(
  layers: ComponentDefaultLayers,
  callback: () => TResult | Promise<TResult>,
): Promise<TResult> {
  if (activeLayers.length > 0) throw new Error('Component default module evaluation cannot overlap')
  activeLayers.push(Object.freeze({
    application: Object.freeze([...(layers.application ?? [])]),
    panel: Object.freeze([...(layers.panel ?? [])]),
    plugins: Object.freeze((layers.plugins ?? []).map(defaults => Object.freeze([...defaults]))),
  }))
  try {
    return await callback()
  } finally {
    activeLayers.pop()
  }
}

export class ComponentDefaultsApplicator<TBuilder extends object> {
  readonly #captured: CapturedComponentDefaults | undefined
  #state: 'applying' | 'applied' | 'pending'

  constructor(kind: DefaultableComponentKind, type: string) {
    this.#captured = captureComponentDefaults(kind, type)
    this.#state = this.#captured ? 'pending' : 'applied'
  }

  configure(builder: TBuilder, compiled = false): void {
    if (this.#state !== 'pending') return
    this.#state = 'applying'
    try {
      const configured = applyCapturedComponentDefaults(this.#captured, builder, compiled)
      if (configured !== builder) throw new TypeError('Automatically applied component defaults must return the configured builder instance')
      this.#state = 'applied'
    } catch (error) {
      this.#state = 'pending'
      throw error
    }
  }
}
