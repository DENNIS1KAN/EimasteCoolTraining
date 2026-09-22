/**
 * UI kit (Night Session). The contract is src/ui/README.md; the chart kit lives in src/ui/charts.
 * Importing the barrel loads the kit's CSS (tokens and base utilities come from src/styles/index.css).
 */
import './ui.css'

export { Icon, ICON_NAMES, isIconName, renderIcon } from './Icon'
export type { IconName, IconProps } from './Icon'

export { Button, ButtonLink, IconButton } from './Button'
export type { ButtonProps, ButtonLinkProps, ButtonVariant, ButtonSize, IconButtonProps, IconButtonVariant } from './Button'

export { Card, CardHeader, CardLink, SectionTitle } from './Card'
export type { CardProps, CardHeaderProps, CardLinkProps, SectionTitleProps } from './Card'

export { PageHeader } from './PageHeader'
export type { PageHeaderProps } from './PageHeader'
export { openAccountSheet, onAccountSheet } from './accountSheet'

export { Avatar, AvatarStack, MemberName } from './Avatar'
export type { AvatarProps, AvatarStackProps, AvatarMember, MemberNameProps } from './Avatar'

export { StatTile, BigNumber, Delta } from './Stat'
export type { StatTileProps, BigNumberProps, BigNumberSize, DeltaProps, DeltaDir, DeltaTone } from './Stat'

export { Chip, Tag, PRBadge } from './Chip'
export type { ChipProps, TagProps, TagTone, PRBadgeProps } from './Chip'

export { Segmented, Tabs } from './Segmented'
export type { SegmentedProps, SegmentOption } from './Segmented'

export { Sheet, ConfirmSheet, SHEET_EXIT_MS } from './Sheet'
export type { SheetProps, ConfirmSheetProps } from './Sheet'

export {
  TextField,
  NumberField,
  TextArea,
  Select,
  Switch,
  Stepper,
  DateField,
  FileDrop,
  parseDecimal,
  sanitizeDecimalDraft,
  canonicalDecimal,
  decimalsOf,
  matchesAccept,
} from './fields'
export type {
  TextFieldProps,
  NumberFieldProps,
  TextAreaProps,
  SelectProps,
  SelectOption,
  SwitchProps,
  StepperProps,
  DateFieldProps,
  FileDropProps,
} from './fields'

export { EmptyState, Banner, Skeleton, Spinner, ProgressBar, WeekDots, LiveDot } from './feedback'
export type {
  EmptyStateProps,
  BannerProps,
  BannerTone,
  SkeletonProps,
  SpinnerProps,
  ProgressBarProps,
  WeekDotsProps,
  WeekDotItem,
  WeekDotState,
} from './feedback'

export { toast, dismissToast, clearToasts, useToasts, Toaster } from './toast'
export type { ToastOptions, ToastTone, ToastItem } from './toast'

export { celebrate } from './celebrate'
export type { CelebrateOptions } from './celebrate'

export { useMediaQuery, useWakeLock, useReducedMotion, useIsDesktop } from './hooks'

export { memberColorVar, initials } from './member'
export { cx } from './cx'
