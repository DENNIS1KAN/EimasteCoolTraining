import { Link } from 'react-router'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtNum } from '../../../lib/format'
import { Avatar, AvatarStack, Icon } from '../../../ui'
import { fmtList, memberHref } from '../format'
import { SQ } from '../messages'

/** Weekly MVP: whoever has the most league points this week (a shared crown on a tie). */
export function MvpBanner({ mvps, points, viewerId }: { mvps: Member[]; points: number; viewerId: string | null }) {
  const t = useT(SQ)
  if (!mvps.length) {
    return (
      <div className="sq-mvp is-open" role="status">
        <span className="sq-mvp__crown" aria-hidden="true">
          <Icon name="crown" size={22} />
        </span>
        <div className="sq-mvp__text">
          <p className="eyebrow">{t('mvpEyebrow')}</p>
          <p className="sq-mvp__title">{t('mvpNoneTitle')}</p>
          <p className="sq-mvp__sub">{t('mvpNoneBody')}</p>
        </div>
      </div>
    )
  }
  const names = fmtList(mvps.map((m) => (m.id === viewerId ? t('youCap') : m.name)))
  const single = mvps.length === 1 ? mvps[0] : null
  const body = (
    <>
      <span className="sq-mvp__crown" aria-hidden="true">
        <Icon name="crown" size={22} />
      </span>
      <div className="sq-mvp__text">
        <p className="eyebrow">{mvps.length > 1 ? `${t('mvpEyebrow')} · ${t('mvpShared')}` : t('mvpEyebrow')}</p>
        <p className="sq-mvp__title">{names}</p>
        <p className="sq-mvp__sub">{t('mvpBody', { points: fmtNum(points, 0) })}</p>
      </div>
      {single ? <Avatar member={single} size={54} decorative /> : <AvatarStack members={mvps} size={40} max={3} />}
    </>
  )
  return single ? (
    <Link to={memberHref(single)} className="sq-mvp" aria-label={`${t('mvpEyebrow')}: ${names}, ${t('mvpBody', { points: fmtNum(points, 0) })}`}>
      {body}
    </Link>
  ) : (
    <div className="sq-mvp">{body}</div>
  )
}
