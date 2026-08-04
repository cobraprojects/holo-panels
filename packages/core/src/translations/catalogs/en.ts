import { defineTranslationCatalog } from '../contracts'

export const EN_MESSAGES = Object.freeze({
  'actions.cancel': 'Cancel',
  'actions.confirm': 'Confirm',
  'actions.create': 'Create',
  'actions.delete': 'Delete',
  'actions.edit': 'Edit',
  'actions.save': 'Save',
  'actions.view': 'View',
  'navigation.open': 'Open navigation',
  'navigation.close': 'Close navigation',
  'pagination.next': 'Next',
  'pagination.previous': 'Previous',
  'pagination.summary': 'Showing {from} to {to} of {total}',
  'records.selected': Object.freeze({
    one: '{count} record selected',
    other: '{count} records selected',
  }),
  'states.empty': 'No records found',
  'states.loading': 'Loading',
} as const)

export const enCatalog = defineTranslationCatalog('en', 'ltr', EN_MESSAGES)
