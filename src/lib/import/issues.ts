/**
 * Problems found while importing a file (workout history or a program). The importers return structured
 * issues, a message key plus its values, so the import sheets can show them in the viewer's language:
 *
 *   issueText({ key: 'badSet', row: 4, vars: { set: 'x', max: 30 } }, 'el')
 *   -> 'Γραμμή 4: το σετ «x» δεν είναι αριθμός σετ από 1 έως 30· παραλείφθηκε.'
 */
import { defineMessages, getLang, translate, type Lang, type Vars } from '../../i18n'

export const ISSUES = defineMessages(
  {
    rowPrefix: 'Row {row}: {text}',
    fileEmpty: 'The file is empty.',
    missingColumn: 'Missing column {cols} in the header row. Expected: {expected}.',
    missingColumns: 'Missing columns {cols} in the header row. Expected: {expected}.',
    moreProblems: '…and {n} more problems.',

    // workout history (logbook CSV)
    badWeek: 'week "{week}" is not a week of {program} (1-{max}); skipped.',
    badWorkout: 'workout "{workout}" is not a day of week {week} ({days}); skipped.',
    ambiguousDay: 'Several days of week {week} are called "{workout}"; rows were matched to the first.',
    badFinishDate: 'finished_on "{value}" is not a date (YYYY-MM-DD); ignored.',
    exerciseNotFound: 'cannot find exercise "{name}" in {day} (week {week}); skipped.',
    exerciseNotFoundAt: 'cannot find exercise #{order} in {day} (week {week}); skipped.',
    exerciseNotFoundAtNamed: 'cannot find exercise #{order} "{name}" in {day} (week {week}); skipped.',
    noExercise: 'no exercise (order or name); skipped.',
    exerciseMoved: 'found "{name}" at position {found}, not {order}.',
    exerciseNotInDay: '"{name}" is not in this workout; used position {order} ({used}).',
    badSet: 'set "{set}" is not a set number between 1 and {max}; skipped.',
    unknownUnit: 'unknown unit "{unit}"; used the workout\'s unit.',
    badDone: 'done "{value}" is not yes/no; treated as no.',
    unknownVariant: '"{performed}" is not {exercise} or one of its substitutions; logged as {exercise}.',
    mixedVariant: '"{performed}" differs from "{earlier}" logged earlier for {exercise} in week {week}; kept "{earlier}".',
    repeatedSet: 'set {set} of {exercise} (week {week}, {day}) repeats row {prev}; the later row wins.',
    mixedUnits: 'Week {week}, {day} mixes kg and lb; weights were converted to {unit}.',
    severalFinishDates: 'Week {week}, {day} has several finish dates ({dates}); used {used}.',

    // programs (JSON or CSV)
    noWeeks: 'The program has no weeks.',
    weekNotObject: 'Week {week} is not an object with "days".',
    weekNoDays: 'Week {week} has no days.',
    weekTooManyDays: 'Week {week} has {n} days; a week can have at most {max}.',
    dayNoName: 'Week {week}, day {day} has no name; called it "{name}".',
    dayNoExercises: 'Week {week}, day {day} ({name}) has no exercises.',
    exerciseNoName: 'Week {week}, day {day} ({name}), exercise {ex} has no name.',
    exercisePrefix: 'Week {week}, day {day} ({name}), exercise {ex}: {text}',
    weeksStartAt1: 'Week numbers must start at 1.',
    weekTwice: 'A week number appears twice (e.g. "1" and "01").',
    weekMissing: 'Week {weeks} is missing: weeks must run from 1 to {max} without gaps.',
    weeksMissing: 'Weeks {weeks} are missing: weeks must run from 1 to {max} without gaps.',
    notJson: 'The file is not valid JSON ({detail}).',
    expectedJsonObject: 'Expected a JSON object with the program weeks.',
    unrecognisedJson: 'Unrecognised JSON: expected { "weeks": [...] }, a program object, or weeks keyed "1", "2", ….',
    workoutLogNotProgram: 'This looks like a workout log export, not a program. Import it as workout history instead.',
    weekNotNumber: 'week "{week}" is not a whole number of 1 or more.',
    weekEmpty: 'the week is empty.',
    dayEmpty: 'the day is empty.',
    exerciseEmpty: 'the exercise name is empty.',
    badWorkingSets: 'working sets "{value}" is not a whole number between 1 and {max}.',
    badWarmupSets: 'warm-up sets "{value}" is not a number or a range like 1-2.',
    badReps: 'reps "{value}" is not a number or a range like 8-10.',
    blockDiffers: 'block "{block}" differs from "{kept}" earlier in week {week}; kept "{kept}".',
    dayReappears:
      'day "{day}" of week {week} appears again after other rows; its exercises were added to the first "{day}". Keep each day\'s rows together and give days of the same week different names.',
    noExerciseRows: 'The file has a header row but no exercise rows.',
    noRowsForWeek: 'No rows for week {weeks}: weeks must run from 1 to {max} without gaps.',
    noRowsForWeeks: 'No rows for weeks {weeks}: weeks must run from 1 to {max} without gaps.',
    badSchedule: 'The schedule in the file is not valid (7 slots of distinct day numbers or null); using the default.',
  },
  {
    rowPrefix: 'Γραμμή {row}: {text}',
    fileEmpty: 'Το αρχείο είναι κενό.',
    missingColumn: 'Λείπει η στήλη {cols} από τη γραμμή επικεφαλίδων. Αναμενόμενες: {expected}.',
    missingColumns: 'Λείπουν οι στήλες {cols} από τη γραμμή επικεφαλίδων. Αναμενόμενες: {expected}.',
    moreProblems: '…και {n} ακόμη προβλήματα.',

    badWeek: 'η εβδομάδα «{week}» δεν υπάρχει στο {program} (1-{max})· παραλείφθηκε.',
    badWorkout: 'η προπόνηση «{workout}» δεν είναι μέρα της εβδομάδας {week} ({days})· παραλείφθηκε.',
    ambiguousDay: 'Πολλές μέρες της εβδομάδας {week} λέγονται «{workout}»· οι γραμμές μπήκαν στην πρώτη.',
    badFinishDate: 'το finished_on «{value}» δεν είναι ημερομηνία (ΕΕΕΕ-ΜΜ-ΗΗ)· αγνοήθηκε.',
    exerciseNotFound: 'δεν βρέθηκε η άσκηση «{name}» στο {day} (εβδομάδα {week})· παραλείφθηκε.',
    exerciseNotFoundAt: 'δεν βρέθηκε η άσκηση #{order} στο {day} (εβδομάδα {week})· παραλείφθηκε.',
    exerciseNotFoundAtNamed: 'δεν βρέθηκε η άσκηση #{order} «{name}» στο {day} (εβδομάδα {week})· παραλείφθηκε.',
    noExercise: 'δεν έχει άσκηση (order ή όνομα)· παραλείφθηκε.',
    exerciseMoved: 'το «{name}» βρέθηκε στη θέση {found}, όχι στη {order}.',
    exerciseNotInDay: 'το «{name}» δεν υπάρχει σε αυτή την προπόνηση· μπήκε στη θέση {order} ({used}).',
    badSet: 'το σετ «{set}» δεν είναι αριθμός σετ από 1 έως {max}· παραλείφθηκε.',
    unknownUnit: 'άγνωστη μονάδα «{unit}»· μπήκε η μονάδα της προπόνησης.',
    badDone: 'το done «{value}» δεν είναι yes/no· μετράει ως όχι.',
    unknownVariant: 'το «{performed}» δεν είναι {exercise} ούτε εναλλακτική του· γράφτηκε ως {exercise}.',
    mixedVariant: 'το «{performed}» διαφέρει από το «{earlier}» που γράφτηκε πριν για {exercise} στην εβδομάδα {week}· κρατήθηκε το «{earlier}».',
    repeatedSet: 'το σετ {set} του {exercise} (εβδομάδα {week}, {day}) επαναλαμβάνει τη γραμμή {prev}· μετράει η τελευταία.',
    mixedUnits: 'Εβδομάδα {week}, {day}: έχει και kg και lb· τα βάρη μετατράπηκαν σε {unit}.',
    severalFinishDates: 'Εβδομάδα {week}, {day}: έχει πολλές ημερομηνίες ολοκλήρωσης ({dates})· μπήκε η {used}.',

    noWeeks: 'Το πρόγραμμα δεν έχει εβδομάδες.',
    weekNotObject: 'Η εβδομάδα {week} δεν είναι αντικείμενο με "days".',
    weekNoDays: 'Η εβδομάδα {week} δεν έχει μέρες.',
    weekTooManyDays: 'Η εβδομάδα {week} έχει {n} μέρες· μια εβδομάδα έχει το πολύ {max}.',
    dayNoName: 'Εβδομάδα {week}, μέρα {day}: δεν έχει όνομα· ονομάστηκε «{name}».',
    dayNoExercises: 'Εβδομάδα {week}, μέρα {day} ({name}): δεν έχει ασκήσεις.',
    exerciseNoName: 'Εβδομάδα {week}, μέρα {day} ({name}), άσκηση {ex}: δεν έχει όνομα.',
    exercisePrefix: 'Εβδομάδα {week}, μέρα {day} ({name}), άσκηση {ex}: {text}',
    weeksStartAt1: 'Οι εβδομάδες πρέπει να αρχίζουν από το 1.',
    weekTwice: 'Ένας αριθμός εβδομάδας υπάρχει δύο φορές (π.χ. "1" και "01").',
    weekMissing: 'Λείπει η εβδομάδα {weeks}: οι εβδομάδες πρέπει να πηγαίνουν από 1 έως {max} χωρίς κενά.',
    weeksMissing: 'Λείπουν οι εβδομάδες {weeks}: οι εβδομάδες πρέπει να πηγαίνουν από 1 έως {max} χωρίς κενά.',
    notJson: 'Το αρχείο δεν είναι έγκυρο JSON ({detail}).',
    expectedJsonObject: 'Χρειάζεται ένα αντικείμενο JSON με τις εβδομάδες του προγράμματος.',
    unrecognisedJson: 'Άγνωστη μορφή JSON: χρειάζεται { "weeks": [...] }, ένα αντικείμενο προγράμματος ή εβδομάδες με κλειδιά "1", "2", ….',
    workoutLogNotProgram: 'Αυτό μοιάζει με εξαγωγή προπονήσεων, όχι με πρόγραμμα. Βάλ’ το ως ιστορικό προπονήσεων.',
    weekNotNumber: 'η εβδομάδα «{week}» δεν είναι ακέραιος από 1 και πάνω.',
    weekEmpty: 'η εβδομάδα είναι κενή.',
    dayEmpty: 'η μέρα είναι κενή.',
    exerciseEmpty: 'το όνομα της άσκησης είναι κενό.',
    badWorkingSets: 'τα σετ εργασίας πρέπει να είναι ακέραιος από 1 έως {max}, όχι «{value}».',
    badWarmupSets: 'τα σετ προθέρμανσης πρέπει να είναι αριθμός ή εύρος όπως 1-2, όχι «{value}».',
    badReps: 'οι επαναλήψεις πρέπει να είναι αριθμός ή εύρος όπως 8-10, όχι «{value}».',
    blockDiffers: 'το block «{block}» διαφέρει από το «{kept}» πιο πάνω στην εβδομάδα {week}· κρατήθηκε το «{kept}».',
    dayReappears:
      'η μέρα «{day}» της εβδομάδας {week} εμφανίζεται ξανά μετά από άλλες γραμμές· οι ασκήσεις της μπήκαν στην πρώτη «{day}». Κράτα τις γραμμές κάθε μέρας μαζί και δώσε διαφορετικά ονόματα στις μέρες της ίδιας εβδομάδας.',
    noExerciseRows: 'Το αρχείο έχει γραμμή επικεφαλίδων αλλά καμία άσκηση.',
    noRowsForWeek: 'Δεν υπάρχουν γραμμές για την εβδομάδα {weeks}: οι εβδομάδες πρέπει να πηγαίνουν από 1 έως {max} χωρίς κενά.',
    noRowsForWeeks: 'Δεν υπάρχουν γραμμές για τις εβδομάδες {weeks}: οι εβδομάδες πρέπει να πηγαίνουν από 1 έως {max} χωρίς κενά.',
    badSchedule: 'Το εβδομαδιαίο πλάνο του αρχείου δεν είναι έγκυρο (7 θέσεις με διαφορετικούς αριθμούς ημερών ή null)· μπαίνει το προεπιλεγμένο.',
  },
)

export type IssueKey = Exclude<keyof (typeof ISSUES)['en'], 'rowPrefix' | 'exercisePrefix'>

/** Where in a program file an exercise problem is (1-based numbers, the day's name). */
export interface ExerciseAt {
  week: number
  day: number
  name: string
  ex: number
}

export interface ImportIssue {
  key: IssueKey
  vars?: Vars
  /** 1-based file row (header = row 1) the issue is about. */
  row?: number
  /** The exercise of a JSON program the issue is about. */
  at?: ExerciseAt
}

export const issue = (key: IssueKey, vars?: Vars, row?: number): ImportIssue => (row == null ? { key, vars } : { key, vars, row })

/** The issue as a sentence in `lang` (the current language by default). */
export function issueText(i: ImportIssue, lang: Lang = getLang()): string {
  const text = translate(ISSUES, i.key, i.vars, lang)
  if (i.row != null) return translate(ISSUES, 'rowPrefix', { row: i.row, text }, lang)
  if (i.at) return translate(ISSUES, 'exercisePrefix', { ...i.at, text }, lang)
  return text
}
