import type { FieldError } from '../lib/draft'

/** Message key for a draft validation error. */
export const errorKey = (e: FieldError | undefined) =>
  e === 'required'
    ? 'errRequired'
    : e === 'number'
      ? 'errNumber'
      : e === 'range'
        ? 'errRange'
        : e === 'time'
          ? 'errTime'
          : e === 'date'
            ? 'errDate'
            : null
