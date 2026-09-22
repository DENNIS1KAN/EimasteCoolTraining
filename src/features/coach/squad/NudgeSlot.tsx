import type { Member } from '../../../data/types'
import { NudgeButton } from '../../squad/NudgeButton'

/** The squad feature's NudgeButton (a friendly push with a 6 h cooldown), sized for a glance row. */
export function NudgeSlot({ member }: { member: Member }) {
  return <NudgeButton member={member} size="sm" />
}
