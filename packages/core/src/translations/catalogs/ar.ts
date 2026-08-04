import { defineTranslationCatalog, type TranslationMessage } from '../contracts'
import type { EN_MESSAGES } from './en'

const AR_MESSAGES = Object.freeze({
  'actions.cancel': 'إلغاء',
  'actions.confirm': 'تأكيد',
  'actions.create': 'إنشاء',
  'actions.delete': 'حذف',
  'actions.edit': 'تعديل',
  'actions.save': 'حفظ',
  'actions.view': 'عرض',
  'navigation.open': 'فتح التنقل',
  'navigation.close': 'إغلاق التنقل',
  'pagination.next': 'التالي',
  'pagination.previous': 'السابق',
  'pagination.summary': 'عرض {from} إلى {to} من {total}',
  'records.selected': Object.freeze({
    zero: 'لم يتم تحديد أي سجلات',
    one: 'تم تحديد سجل واحد',
    two: 'تم تحديد سجلين',
    few: 'تم تحديد {count} سجلات',
    many: 'تم تحديد {count} سجلًا',
    other: 'تم تحديد {count} سجل',
  }),
  'states.empty': 'لا توجد سجلات',
  'states.loading': 'جارٍ التحميل',
} as const satisfies { readonly [TKey in keyof typeof EN_MESSAGES]: TranslationMessage })

export const arCatalog = defineTranslationCatalog('ar', 'rtl', AR_MESSAGES)
