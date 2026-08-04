import {
  CalloutBuilder,
  CustomComponentBuilder,
  EmptyStateBuilder,
  FieldsetBuilder,
  GridBuilder,
  GroupBuilder,
  type SchemaComponentBuilder,
  SectionBuilder,
  SplitBuilder,
  StepBuilder,
  TabBuilder,
  TabsBuilder,
  WizardBuilder,
} from './builder'
import type { OptionalRuntimeTypeValue, RecordTypeSource, RecordTypeValue, RuntimeTypeSource } from '../inference/type-source'
import {
  EntrySchemaComponentBuilder,
  FilterSchemaComponentBuilder,
  WidgetSchemaComponentBuilder,
  type EntrySchemaSource,
  type FilterSchemaSource,
  type WidgetSchemaSource,
} from './leaves'

type DefaultValues = Readonly<Record<string, unknown>>

export function grid(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): GridBuilder<DefaultValues, unknown> {
  return new GridBuilder(children)
}

export function section(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): SectionBuilder<DefaultValues, unknown> {
  return new SectionBuilder(children)
}

export function group(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): GroupBuilder<DefaultValues, unknown> {
  return new GroupBuilder(children)
}

export function fieldset(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): FieldsetBuilder<DefaultValues, unknown> {
  return new FieldsetBuilder(children)
}

export function tabs(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): TabsBuilder<DefaultValues, unknown> {
  return new TabsBuilder(children)
}

export function tab(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): TabBuilder<DefaultValues, unknown> {
  return new TabBuilder(children)
}

export function wizard(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): WizardBuilder<DefaultValues, unknown> {
  return new WizardBuilder(children)
}

export function step(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): StepBuilder<DefaultValues, unknown> {
  return new StepBuilder(children)
}

export function split(
  children: readonly SchemaComponentBuilder<DefaultValues, unknown>[] = [],
): SplitBuilder<DefaultValues, unknown> {
  return new SplitBuilder(children)
}

export function callout(): CalloutBuilder<DefaultValues, unknown> {
  return new CalloutBuilder<DefaultValues, unknown>()
}

export function emptyState(): EmptyStateBuilder<DefaultValues, unknown> {
  return new EmptyStateBuilder<DefaultValues, unknown>()
}

export function customComponent(
  type: string,
): CustomComponentBuilder<DefaultValues, unknown> {
  return new CustomComponentBuilder<DefaultValues, unknown>(type)
}

export interface SchemaComponentFactory<TValues, TContext> {
  callout(): CalloutBuilder<TValues, TContext>
  custom(type: string): CustomComponentBuilder<TValues, TContext>
  emptyState(): EmptyStateBuilder<TValues, TContext>
  entry<TSource extends EntrySchemaSource>(source: TSource): EntrySchemaComponentBuilder<TSource, TValues, TContext>
  fieldset(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): FieldsetBuilder<TValues, TContext>
  filter<TSource extends FilterSchemaSource>(source: TSource): FilterSchemaComponentBuilder<TSource, TValues, TContext>
  grid(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): GridBuilder<TValues, TContext>
  group(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): GroupBuilder<TValues, TContext>
  section(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): SectionBuilder<TValues, TContext>
  split(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): SplitBuilder<TValues, TContext>
  step(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): StepBuilder<TValues, TContext>
  tab(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): TabBuilder<TValues, TContext>
  tabs(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): TabsBuilder<TValues, TContext>
  widget<TSource extends WidgetSchemaSource>(source: TSource): WidgetSchemaComponentBuilder<TSource, TValues, TContext>
  wizard(children?: readonly SchemaComponentBuilder<TValues, TContext>[]): WizardBuilder<TValues, TContext>
}

export function schemaComponentsFor<
  TValuesSource extends RecordTypeSource,
  TContextSource extends RuntimeTypeSource | undefined = undefined,
>(
  _values: TValuesSource,
  _context?: TContextSource,
): SchemaComponentFactory<RecordTypeValue<TValuesSource>, OptionalRuntimeTypeValue<TContextSource>> {
  type TValues = RecordTypeValue<TValuesSource>
  type TContext = OptionalRuntimeTypeValue<TContextSource>
  return Object.freeze({
    callout: () => new CalloutBuilder<TValues, TContext>(),
    custom: (type: string) => new CustomComponentBuilder<TValues, TContext>(type),
    emptyState: () => new EmptyStateBuilder<TValues, TContext>(),
    entry: <TSource extends EntrySchemaSource>(source: TSource) => new EntrySchemaComponentBuilder<TSource, TValues, TContext>(source),
    fieldset: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new FieldsetBuilder(children),
    filter: <TSource extends FilterSchemaSource>(source: TSource) => new FilterSchemaComponentBuilder<TSource, TValues, TContext>(source),
    grid: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new GridBuilder(children),
    group: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new GroupBuilder(children),
    section: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new SectionBuilder(children),
    split: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new SplitBuilder(children),
    step: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new StepBuilder(children),
    tab: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new TabBuilder(children),
    tabs: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new TabsBuilder(children),
    widget: <TSource extends WidgetSchemaSource>(source: TSource) => new WidgetSchemaComponentBuilder<TSource, TValues, TContext>(source),
    wizard: (children: readonly SchemaComponentBuilder<TValues, TContext>[] = []) => new WizardBuilder(children),
  })
}
