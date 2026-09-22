import { defineMessages } from '../../i18n'

/** The chart kit's own strings (everything else arrives through props, already translated). */
export const M = defineMessages(
  {
    data: 'Data',
    noData: 'No data yet',
    less: 'Less',
    more: 'More',
    date: 'Date',
    noValue: 'no data',
  },
  {
    data: 'Δεδομένα',
    noData: 'Δεν υπάρχουν δεδομένα ακόμη',
    less: 'Λιγότερο',
    more: 'Περισσότερο',
    date: 'Ημερομηνία',
    noValue: 'χωρίς δεδομένα',
  },
)

/** Placeholder for a missing value in tooltips and tables. */
export const DASH = '–'
