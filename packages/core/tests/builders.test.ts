import { describe, expect, expectTypeOf, it } from 'vitest'
import { LabelCapability, type LabelState, VisibilityCapability, type VisibilityState } from '../src/builders/capabilities'
import { ConstructionBuilder } from '../src/builders/construction-builder'
import { deepFreeze } from '../src/builders/deep-freeze'
import { assignStableId, assignStableKey } from '../src/builders/stable-id'

interface CustomState extends LabelState, VisibilityState {
  custom: string
  nested: { values: string[] }
}

interface CustomDefinition extends CustomState {
  id: string
}

class CustomBuilder extends ConstructionBuilder<CustomState, CustomDefinition> {
  readonly #labels = new LabelCapability(this)
  readonly #visibility = new VisibilityCapability(this)
  readonly label = this.#labels.label
  readonly hidden = this.#visibility.hidden
  readonly visible = this.#visibility.visible

  constructor() {
    super({
      custom: 'initial',
      hidden: false,
      label: null,
      nested: { values: ['one'] },
    })
  }

  addInvariant(name: string, invariant: (state: Readonly<CustomState>) => void): void {
    this.registerInvariant(name, invariant)
  }

  change<TKey extends keyof CustomState>(key: TKey, value: CustomState[TKey]): void {
    this.writeState(key, value)
  }

  custom(value: string): this {
    return this.writeState('custom', value)
  }

  protected createDefinition(state: Readonly<CustomState>): CustomDefinition {
    return {
      ...state,
      id: assignStableId('fixture', 'field', assignStableKey('field', 'custom', [])),
    }
  }
}

class PlainBuilder extends ConstructionBuilder<{ value: string }, { value: string }> {
  constructor() {
    super({ value: 'plain' })
  }

  protected createDefinition(state: Readonly<{ value: string }>): { value: string } {
    return { ...state }
  }
}

describe('construction builders', () => {
  it('preserves the concrete builder type through common capabilities', () => {
    const builder = new CustomBuilder()
    const chained = builder.label('Name').hidden().custom('ready').visible()

    expectTypeOf(chained).toEqualTypeOf<CustomBuilder>()
    expect(chained.compile()).toMatchObject({
      custom: 'ready',
      hidden: false,
      label: 'Name',
    })
  })

  it('does not add unrelated capability methods', () => {
    type PlainMethods = keyof PlainBuilder
    type LabelMethod = Extract<PlainMethods, 'label'>

    expectTypeOf<LabelMethod>().toEqualTypeOf<never>()
    expect(new PlainBuilder()).not.toHaveProperty('label')
  })

  it('deeply freezes compiled definitions and reuses the final definition', () => {
    const builder = new CustomBuilder().label('Name')
    const definition = builder.compile()

    expect(Object.isFrozen(definition)).toBe(true)
    expect(Object.isFrozen(definition.nested)).toBe(true)
    expect(Object.isFrozen(definition.nested.values)).toBe(true)
    expect(builder.compile()).toBe(definition)
    expect(() => Reflect.apply(Array.prototype.push, definition.nested.values, ['two'])).toThrow()
  })

  it('preserves callbacks with primitive and void return types while freezing containers', () => {
    const branded = 'app:field:money' as string & { readonly __brand: 'extension-id' }
    const definition = deepFreeze({
      allowed: () => true,
      branded,
      notify: () => undefined,
      title: () => 'Ready' as const,
    })

    expectTypeOf(definition.allowed).toBeFunction()
    expectTypeOf(definition.branded).toEqualTypeOf<typeof branded>()
    expectTypeOf(definition.notify).toBeFunction()
    expectTypeOf(definition.title).toBeFunction()
    expect(Object.isFrozen(definition.allowed)).toBe(false)
    expect(definition.allowed()).toBe(true)
    expect(definition.title()).toBe('Ready')
  })

  it('rejects state changes after compilation while allowing idempotent calls', () => {
    const builder = new CustomBuilder().label('Name')
    builder.compile()

    expect(builder.label('Name')).toBe(builder)
    expect(() => builder.label('Other')).toThrow(/after the builder has been compiled/)
  })

  it('runs capability invariants before finalization', () => {
    expect(() => new CustomBuilder().label('  ').compile()).toThrow('A label cannot be empty')
  })

  it('assigns stable normalized keys and IDs', () => {
    expect(assignStableKey('TextField', undefined, ['User Form', 2])).toBe('text-field-user-form-2')
    expect(assignStableId('Acme Plugin', 'TextField', 'User Name')).toBe(
      'acme-plugin:text-field:user-name',
    )
    expect(() => assignStableKey('field', undefined, [])).toThrow(/key or stable schema position/)
  })
})
