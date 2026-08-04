export type AccessibilityPatternName =
  | 'combobox'
  | 'data-table'
  | 'dialog'
  | 'field'
  | 'focus-trap'
  | 'live-region'
  | 'menu'
  | 'tabs'

export interface AccessibilityKeyboardBinding {
  readonly key: string
  readonly behavior: string
}

export interface AccessibilityPattern {
  readonly name: AccessibilityPatternName
  readonly roles: readonly string[]
  readonly requiredAttributes: readonly string[]
  readonly keyboard: readonly AccessibilityKeyboardBinding[]
  readonly behavior: readonly string[]
}

export const accessibilityPatterns: Readonly<Record<AccessibilityPatternName, AccessibilityPattern>> = {
  'focus-trap': {
    name: 'focus-trap',
    roles: [],
    requiredAttributes: [],
    keyboard: [
      { key: 'Tab', behavior: 'Move forward and wrap within the active surface' },
      { key: 'Shift+Tab', behavior: 'Move backward and wrap within the active surface' },
      { key: 'Escape', behavior: 'Request close when the surface is dismissible' },
    ],
    behavior: [
      'Move initial focus to an explicit target or the first focusable control',
      'Keep focus inside the topmost modal surface',
      'Restore focus to the invoking control after close',
    ],
  },
  field: {
    name: 'field',
    roles: [],
    requiredAttributes: ['id', 'aria-describedby', 'aria-invalid', 'aria-errormessage'],
    keyboard: [],
    behavior: [
      'Associate every control with a visible label or accessible name',
      'Associate descriptions and validation errors using stable IDs',
      'Move focus to the first invalid field after a rejected submission',
    ],
  },
  'live-region': {
    name: 'live-region',
    roles: ['status', 'alert'],
    requiredAttributes: ['aria-live', 'aria-atomic'],
    keyboard: [],
    behavior: [
      'Use polite status announcements for non-blocking updates',
      'Use assertive alerts only for errors that require immediate attention',
      'Keep the region mounted so updates are announced consistently',
    ],
  },
  dialog: {
    name: 'dialog',
    roles: ['dialog', 'alertdialog'],
    requiredAttributes: ['aria-modal', 'aria-labelledby', 'aria-describedby'],
    keyboard: [
      { key: 'Tab', behavior: 'Follow the focus-trap pattern' },
      { key: 'Escape', behavior: 'Request close when dismissal is allowed' },
    ],
    behavior: [
      'Render a labelled modal surface over inert background content',
      'Apply the focus-trap pattern and restore invoking focus',
    ],
  },
  combobox: {
    name: 'combobox',
    roles: ['combobox', 'listbox', 'option'],
    requiredAttributes: ['aria-controls', 'aria-expanded', 'aria-activedescendant', 'aria-autocomplete'],
    keyboard: [
      { key: 'ArrowDown', behavior: 'Open the list and move to the next option' },
      { key: 'ArrowUp', behavior: 'Open the list and move to the previous option' },
      { key: 'Enter', behavior: 'Select the active option' },
      { key: 'Escape', behavior: 'Close the list without changing the value' },
      { key: 'Home', behavior: 'Move to the first option' },
      { key: 'End', behavior: 'Move to the last option' },
    ],
    behavior: [
      'Keep DOM focus on the input while exposing the active option',
      'Expose loading, empty, and validation states without erasing the accessible name',
    ],
  },
  tabs: {
    name: 'tabs',
    roles: ['tablist', 'tab', 'tabpanel'],
    requiredAttributes: ['aria-controls', 'aria-selected', 'aria-labelledby', 'tabindex'],
    keyboard: [
      { key: 'ArrowRight', behavior: 'Move to the next enabled horizontal tab' },
      { key: 'ArrowLeft', behavior: 'Move to the previous enabled horizontal tab' },
      { key: 'ArrowDown', behavior: 'Move to the next enabled vertical tab' },
      { key: 'ArrowUp', behavior: 'Move to the previous enabled vertical tab' },
      { key: 'Home', behavior: 'Move to the first enabled tab' },
      { key: 'End', behavior: 'Move to the last enabled tab' },
    ],
    behavior: ['Use roving tabindex and keep each tab associated with exactly one panel'],
  },
  menu: {
    name: 'menu',
    roles: ['menu', 'menuitem', 'menuitemcheckbox', 'menuitemradio'],
    requiredAttributes: ['aria-haspopup', 'aria-expanded', 'aria-controls'],
    keyboard: [
      { key: 'ArrowDown', behavior: 'Move to the next enabled item' },
      { key: 'ArrowUp', behavior: 'Move to the previous enabled item' },
      { key: 'Home', behavior: 'Move to the first enabled item' },
      { key: 'End', behavior: 'Move to the last enabled item' },
      { key: 'Enter', behavior: 'Activate the focused item' },
      { key: 'Space', behavior: 'Activate the focused item' },
      { key: 'Escape', behavior: 'Close and restore trigger focus' },
    ],
    behavior: ['Use roving tabindex and skip disabled items during navigation'],
  },
  'data-table': {
    name: 'data-table',
    roles: ['table', 'rowgroup', 'row', 'columnheader', 'cell'],
    requiredAttributes: ['aria-sort', 'aria-label'],
    keyboard: [
      { key: 'Space', behavior: 'Toggle the focused row selection control' },
      { key: 'Enter', behavior: 'Activate a focused sortable column or row action' },
    ],
    behavior: [
      'Use native table semantics when the layout is tabular',
      'Expose sort direction and an accessible name for bulk selection',
      'Preserve logical reading order at every responsive breakpoint',
    ],
  },
}

export interface FieldAccessibilityIds {
  readonly control: string
  readonly label: string
  readonly description: string
  readonly error: string
}

export function createFieldAccessibilityIds(componentId: string): FieldAccessibilityIds {
  const normalizedId = componentId.trim()
  if (!normalizedId) {
    throw new Error('Accessible component IDs cannot be empty')
  }
  return {
    control: `${normalizedId}-control`,
    label: `${normalizedId}-label`,
    description: `${normalizedId}-description`,
    error: `${normalizedId}-error`,
  }
}
