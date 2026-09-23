import { defineMessages } from '../../i18n'

/** The chart kit's own strings (everything else arrives through props, already translated). */
export const M = defineMessages({
  data: 'Data',
  noData: 'No data yet',
  less: 'Less',
  more: 'More',
  date: 'Date',
  noValue: 'no data',
})

/** Placeholder for a missing value in tooltips and tables. */
export const DASH = '–'
