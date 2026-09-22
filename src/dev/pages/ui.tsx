import { useState, type ReactNode } from 'react'
import { setThemePref, useThemePref, type ThemePref } from '../../app/theme'
import { setLang, useLang, type Lang } from '../../i18n'
import {
  Avatar,
  AvatarStack,
  Banner,
  BigNumber,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  CardLink,
  Chip,
  ConfirmSheet,
  DateField,
  Delta,
  EmptyState,
  FileDrop,
  ICON_NAMES,
  Icon,
  IconButton,
  LiveDot,
  MemberName,
  NumberField,
  PRBadge,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  Spinner,
  StatTile,
  Stepper,
  Switch,
  Tabs,
  Tag,
  TextArea,
  TextField,
  Toaster,
  WeekDots,
  celebrate,
  memberColorVar,
  toast,
} from '../../ui'

/**
 * UI kit playground (#/dev/ui): every component in realistic states.
 * Toggle theme and language in the header; screenshot with colorScheme light/dark at 390 and 1280 px.
 */

const STELIOS = { name: 'Stelios', color: 'blue' }
const THANOS = { name: 'Thanos', color: 'orange' }
const DENNIS = { name: 'Dennis', color: 'aqua' }
const SQUAD = [STELIOS, THANOS, DENNIS, { name: 'Maria Kosta', color: 'magenta' }, { name: 'Nikos', color: 'green' }]

const CSS = `
.devui { max-width: 1240px; margin: 0 auto; }
.devui__cols { display: grid; gap: 10px; align-items: start; }
@media (min-width: 900px) { .devui__cols { grid-template-columns: 390px minmax(0, 1fr); gap: 28px; } .devui__phone { position: sticky; top: 16px; } }
.devui__grid { display: grid; gap: 10px; align-items: start; }
@media (min-width: 1100px) { .devui__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.devui__icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 4px; }
.devui__icon { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 2px 8px; border-radius: var(--r-sm); color: var(--ink); }
.devui__icon span { font: 600 9.5px/1.2 var(--font-body); color: var(--muted); text-align: center; word-break: break-word; }
.devui__icon:hover { background: var(--surface-2); }
.devui__swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.devui__sw { display: flex; flex-direction: column; gap: 5px; font: 700 10.5px/1.2 var(--font-body); color: var(--ink-2); }
.devui__sw i { height: 36px; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--card-border), inset 0 0 0 1px var(--line); }
.devui__label { font: 800 9.5px/12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 14px 0 8px; }
.devui__label:first-child { margin-top: 0; }
.devui__wrap { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.devui__hero-top { display: flex; align-items: center; justify-content: space-between; }
.devui__live { display: inline-flex; align-items: center; gap: 7px; font: 800 11px/1 var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.devui__hero-mid { display: flex; align-items: flex-end; justify-content: space-between; margin: 12px 0 14px; }
.devui__hero-meta { display: flex; flex-direction: column; gap: 7px; align-items: flex-end; padding-bottom: 2px; margin: 0; padding-left: 0; list-style: none; }
.devui__hero-meta li { display: flex; align-items: center; gap: 6px; font: 700 13px/1 var(--font-body); }
.devui__hero-meta .ui-icon { color: var(--muted); }
.devui__note { display: flex; gap: 12px; align-items: flex-start; }
.devui__note b { font-weight: 800; color: var(--ink); }
.devui__pulse { display: flex; gap: 12px; align-items: center; margin-top: 2px; }
.devui__pulse-t { font: 600 14px/17px var(--font-body); color: var(--ink-2); }
.devui__pulse-t b { font-weight: 800; color: var(--ink); }
.devui__pulse-s { display: flex; align-items: center; gap: 8px; margin-top: 4px; font: 700 12px/1 var(--font-body); color: var(--muted); }
.devui__type > * + * { margin-top: 12px; }
.devui__skel { display: flex; gap: 12px; align-items: center; }
`

function Label({ children }: { children: ReactNode }) {
  return <p className="devui__label">{children}</p>
}

function Swatch({ name }: { name: string }) {
  return (
    <div className="devui__sw">
      <i style={{ background: `var(${name})` }} />
      {name}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card as="section">
      <CardHeader title={title} subtitle={subtitle} />
      {children}
    </Card>
  )
}

/** A phone-width Home composition built only from kit parts, to compare against the mockup. */
function HomeComposition() {
  return (
    <div className="stack devui__phone">
      <PageHeader variant="greeting" eyebrow="Thu 24 Sep · Week 3 of 12" title="Καλησπέρα, Στέλιο" actions={<IconButton icon="bell" label="Notifications" badge />} account />
      <Card padding="sm" className="devui__note">
        <Avatar member={DENNIS} size={32} decorative />
        <div>
          <p className="muted" style={{ font: '700 12px/16px var(--font-body)' }}>
            <b>Coach Dennis</b> · 08:12
          </p>
          <p className="ink-2" style={{ font: '600 13px/18px var(--font-body)', marginTop: 1 }}>
            3-sec negatives on pulldowns today. Beat last week’s rows and souvlaki’s on me.
          </p>
        </div>
      </Card>
      <Card night glow={memberColorVar('blue')} style={{ padding: '14px 14px 14px 16px' }}>
        <div className="devui__hero-top">
          <span className="devui__live">
            <LiveDot />
            Today · Hypertrophy
          </span>
          <WeekDots
            label="This week: 2 of 5 done"
            items={[
              { label: 'U', state: 'done', title: 'Upper' },
              { label: 'L', state: 'done', title: 'Lower' },
              { label: 'P', state: 'today', title: 'Pull' },
              { label: 'P', state: 'upcoming', title: 'Push' },
              { label: 'L', state: 'upcoming', title: 'Legs' },
            ]}
          />
        </div>
        <div className="devui__hero-mid">
          <h2 className="ui-bignum ui-bignum--xl" style={{ textTransform: 'uppercase' }}>
            Pull
          </h2>
          <ul className="devui__hero-meta">
            <li>
              <Icon name="list" size={16} />7 exercises
            </li>
            <li>
              <Icon name="clock" size={16} />
              ~65 min
            </li>
          </ul>
        </div>
        <Button block icon="play">
          Start workout
        </Button>
      </Card>
      <div className="grid-3">
        <StatTile icon="flame" value="3" unit="wk" label="Week streak" />
        <StatTile icon="calendar-check" value="92" unit="%" label="On schedule" />
        <StatTile icon="trophy" value="4" label="PRs in Sept" />
      </div>
      <div className="grid-2">
        <Card padding="sm" style={{ borderRadius: 'var(--r-mini)' }}>
          <div className="row-between">
            <p className="eyebrow">Weight</p>
            <Delta text="1.5 kg" dir="down" tone="good" />
          </div>
          <BigNumber value="80.9" unit="kg" size="md" style={{ marginTop: 5 }} />
          <ProgressBar value={0.34} color={memberColorVar('blue')} height={5} label="Goal progress" style={{ marginTop: 12 }} />
        </Card>
        <Card padding="sm" style={{ borderRadius: 'var(--r-mini)' }} to="/fuel">
          <div className="row-between">
            <p className="eyebrow">Fuel today</p>
            <Icon name="chevron-right" size={16} className="muted" />
          </div>
          <BigNumber value="1,510" size="sm" style={{ marginTop: 8 }} />
          <p className="muted" style={{ font: '700 11px/14px var(--font-body)', marginTop: 3 }}>
            of 2,400 kcal
          </p>
          <p className="ink-2 row" style={{ font: '700 11.5px/14px var(--font-body)', marginTop: 8, gap: 6 }}>
            <Icon name="clock" size={14} className="muted" />
            Pre-workout · 17:30
          </p>
        </Card>
      </div>
      <Card padding="sm">
        <CardHeader title="Squad pulse" action={<CardLink to="/squad">You lead Thanos 5–2</CardLink>} />
        <div className="devui__pulse">
          <Avatar member={THANOS} decorative />
          <div>
            <p className="devui__pulse-t">
              <b>Thanos</b> finished <b>Push</b> · 2h
            </p>
            <p className="devui__pulse-s">
              <PRBadge />
              Bench press
              <span className="num" style={{ fontSize: 15, color: 'var(--ink)' }}>
                80 kg<i className="mul">×</i>8
              </span>
            </p>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <Chip selected onClick={() => {}}>
            🔥 2
          </Chip>
          <Chip onClick={() => {}}>💪 1</Chip>
          <Chip onClick={() => {}}>👏 1</Chip>
          <span className="spacer" />
          <Button variant="ghost" size="sm" icon="plus-circle">
            Kudos
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default function UIPlayground() {
  const theme = useThemePref()
  const lang = useLang()
  const [seg, setSeg] = useState('h2h')
  const [range, setRange] = useState('1m')
  const [day, setDay] = useState('pull')
  const [tab, setTab] = useState('members')
  const [kg, setKg] = useState('57.5')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState(80.7)
  const [plates, setPlates] = useState(60)
  const [unit, setUnit] = useState('kg')
  const [date, setDate] = useState('2026-09-22')
  const [sw1, setSw1] = useState(true)
  const [sw2, setSw2] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [sheet, setSheet] = useState<null | 'log' | 'full' | 'confirm' | 'plain'>(null)
  const [banner, setBanner] = useState(true)
  const [chips, setChips] = useState<string[]>(['upper'])

  const toggleChip = (v: string) => setChips((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))

  return (
    <div className="devui">
      <style>{CSS}</style>
      <Toaster />
      <div className="stack-lg">
        <PageHeader
          eyebrow="Dev · UI kit · Night Session"
          title="UI kit"
          actions={
            <>
              <Segmented<ThemePref>
                size="sm"
                ariaLabel="Theme"
                value={theme}
                onChange={setThemePref}
                options={[
                  { value: 'system', label: null, icon: 'monitor', ariaLabel: 'System' },
                  { value: 'light', label: null, icon: 'sun', ariaLabel: 'Light' },
                  { value: 'dark', label: null, icon: 'moon', ariaLabel: 'Dark' },
                ]}
              />
              <Segmented<Lang>
                size="sm"
                ariaLabel="Language"
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'en', label: 'EN' },
                  { value: 'el', label: 'ΕΛ' },
                ]}
              />
            </>
          }
        />

        <div className="devui__cols">
          <HomeComposition />

          <div className="devui__grid">
            <Section title="Buttons" subtitle="primary · secondary · ghost · tonal · danger">
              <Label>Sizes</Label>
              <div className="devui__wrap">
                <Button size="lg" icon="play">
                  Start workout
                </Button>
                <Button>Save</Button>
                <Button size="sm">Finish</Button>
              </div>
              <Label>Variants</Label>
              <div className="devui__wrap">
                <Button variant="secondary" icon="swap">
                  Swap
                </Button>
                <Button variant="ghost" size="sm">
                  Finish
                </Button>
                <Button variant="tonal" icon="history">
                  History
                </Button>
                <Button variant="danger" icon="trash">
                  Delete
                </Button>
              </div>
              <Label>States</Label>
              <div className="devui__wrap">
                <Button loading>Saving</Button>
                <Button variant="secondary" loading>
                  Syncing
                </Button>
                <Button disabled>Disabled</Button>
                <ButtonLink to="/squad" variant="ghost" iconRight="arrow-right">
                  Squad
                </ButtonLink>
              </div>
              <Label>Block</Label>
              <Button block size="lg" icon="check">
                Log 80.7 kg
              </Button>
              <Label>Icon buttons</Label>
              <div className="devui__wrap">
                <IconButton icon="bell" label="Notifications" badge />
                <IconButton icon="message" label="Messages" badge={3} />
                <IconButton icon="more" label="More options" variant="ghost" />
                <IconButton icon="video" label="Demo video" variant="outline" />
                <IconButton icon="x" label="Close" size={36} />
                <IconButton icon="check" label="Done" variant="accent" size={52} iconSize={24} />
                <IconButton icon="edit" label="Edit" disabled />
              </div>
            </Section>

            <Section title="Chips, tags & badges">
              <Label>Chips</Label>
              <div className="devui__wrap">
                <Chip icon="machine">Hammer Strength</Chip>
                <Chip icon="bolt">Last set: Failure</Chip>
                <Chip tone="accent" icon="target">
                  Aim 57.5 kg
                </Chip>
                <Chip size="sm">~8–9 RPE</Chip>
              </div>
              <Label>Filter chips (toggle)</Label>
              <div className="devui__wrap">
                {['upper', 'lower', 'pull', 'push', 'legs'].map((v) => (
                  <Chip key={v} selected={chips.includes(v)} onClick={() => toggleChip(v)}>
                    {v[0].toUpperCase() + v.slice(1)}
                  </Chip>
                ))}
              </div>
              <Label>Tags</Label>
              <div className="devui__wrap">
                <Tag>Fail</Tag>
                <Tag tone="accent" icon="bolt">
                  Last set · Failure
                </Tag>
                <Tag tone="good" icon="check">
                  Active
                </Tag>
                <Tag tone="warn">Behind</Tag>
                <Tag tone="danger">Missed</Tag>
                <Tag tone="solid">Next</Tag>
                <PRBadge />
                <PRBadge pop label="PR +2.5" />
              </div>
              <Label>Deltas</Label>
              <div className="devui__wrap">
                <Delta text="1.5 kg" dir="down" tone="good" />
                <Delta text="0.4 kg" dir="up" tone="warn" />
                <Delta text="0.0 kg" dir="flat" />
                <Delta text="2 sessions" dir="down" tone="danger" />
              </div>
            </Section>

            <Section title="Segmented & tabs">
              <Label>md, block (page tabs)</Label>
              <Tabs
                block
                ariaLabel="Squad view"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: 'board', label: 'Board' },
                  { value: 'h2h', label: 'Head-to-head' },
                  { value: 'feed', label: 'Feed' },
                ]}
              />
              <Label>sm (range)</Label>
              <Segmented
                size="sm"
                ariaLabel="Range"
                value={range}
                onChange={setRange}
                options={[
                  { value: '1m', label: '1M' },
                  { value: '3m', label: '3M' },
                  { value: 'all', label: 'All' },
                ]}
              />
              <Label>lg, with sub-labels (day tabs)</Label>
              <Segmented
                size="lg"
                block
                ariaLabel="Workout day"
                value={day}
                onChange={setDay}
                options={[
                  { value: 'upper', label: 'Upper', sub: <><Icon name="check" size={11} />Str</> },
                  { value: 'lower', label: 'Lower', sub: <><Icon name="check" size={11} />Str</> },
                  { value: 'pull', label: 'Pull', sub: 'Hyp · now' },
                  { value: 'push', label: 'Push', sub: 'Hyp' },
                  { value: 'legs', label: 'Legs', sub: 'Hyp', disabled: true },
                ]}
              />
              <Label>With icons</Label>
              <Segmented
                ariaLabel="Coach console"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'members', label: 'Members', icon: 'users' },
                  { value: 'nutrition', label: 'Nutrition', icon: 'fuel' },
                  { value: 'programs', label: 'Programs', icon: 'list' },
                ]}
              />
            </Section>

            <Section title="Avatars & members">
              <Label>Sizes</Label>
              <div className="devui__wrap">
                <Avatar member={STELIOS} size={24} />
                <Avatar member={STELIOS} size={32} />
                <Avatar member={THANOS} size={40} />
                <Avatar member={DENNIS} size={54} />
                <Avatar member={{ name: 'Maria Kosta', color: 'magenta' }} size={80} />
              </div>
              <Label>Ring · you · stack</Label>
              <div className="devui__wrap" style={{ gap: 16 }}>
                <Avatar member={THANOS} ring />
                <Avatar member={STELIOS} you />
                <AvatarStack members={SQUAD.slice(0, 3)} />
                <AvatarStack members={SQUAD} max={3} size={24} />
              </div>
              <Label>Member names</Label>
              <div className="devui__wrap" style={{ gap: 16, font: '700 14px var(--font-body)' }}>
                <MemberName member={STELIOS} you />
                <MemberName member={THANOS} />
                <MemberName member={DENNIS} />
              </div>
            </Section>

            <Section title="Numbers">
              <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <BigNumber value="80.9" unit="kg" size="xxl" />
                <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
                  <Delta text="1.5 kg" dir="down" tone="good" />
                  <BigNumber value="−0.6" unit="kg/wk" size="sm" />
                </div>
              </div>
              <div className="devui__wrap" style={{ marginTop: 16, alignItems: 'flex-end', gap: 18 }}>
                <BigNumber value="PULL" size="xl" />
                <BigNumber value="5–2" size="lg" />
                <BigNumber value="124" unit="/ 180 g" size="md" />
                <BigNumber value="1:47" size="md" />
              </div>
              <Label>Stat tiles</Label>
              <div className="grid-2">
                <StatTile icon="scale" value="80.9" unit="kg" label="Weight" delta={{ text: '1.5 kg', dir: 'down', tone: 'good' }} to="/body" />
                <StatTile icon="bolt" value="18.4" unit="t" label="Volume this week" sub="+8.2% vs last" delta={{ text: '1.2 t', dir: 'up', tone: 'neutral' }} />
              </div>
            </Section>

            <Section title="Fields">
              <div className="stack">
                <TextField label="Display name" placeholder="Your name" defaultValue="Stelios" hint="Shown to the squad." />
                <TextField label="Invite code" placeholder="XXXX-XXXX" icon="lock" error="That code has expired. Ask Dennis for a new one." defaultValue="7Q2K" />
                <div className="grid-2">
                  <NumberField label="Weight" value={kg} onChange={setKg} suffix="kg" decimals={2} min={0} max={500} hint={`value: "${kg}"`} />
                  <NumberField label="Reps" value={reps} onChange={setReps} decimals={0} min={0} max={100} placeholder="10" />
                </div>
                <div className="grid-2">
                  <NumberField aria-label="Set 1 kg" size="lg" value="57.5" onChange={() => {}} placeholder="57.5" />
                  <NumberField aria-label="Set 2 reps" size="lg" value="" onChange={() => {}} placeholder="9" decimals={0} />
                </div>
                <Select
                  label="Units"
                  value={unit}
                  onChange={setUnit}
                  options={[
                    { value: 'kg', label: 'Kilograms (kg)' },
                    { value: 'lb', label: 'Pounds (lb)' },
                  ]}
                />
                <DateField label="Program start" value={date} onChange={setDate} max="2026-12-31" />
                <TextArea label="Note for the squad" placeholder="How did it feel?" rows={3} />
                <div>
                  <Switch checked={sw1} onChange={setSw1} label="Share my exact weight" description="Others see 80.9 kg instead of the change only." />
                  <Switch checked={sw2} onChange={setSw2} label="Rest timer sound" />
                </div>
                <div className="row wrap" style={{ gap: 12 }}>
                  <Stepper label="Body weight" value={weight} onChange={setWeight} step={0.1} min={30} max={250} unit="kg" />
                  <Stepper label="Load" size="lg" value={plates} onChange={setPlates} step={2.5} min={0} max={300} unit="kg" />
                </div>
                <FileDrop
                  accept="application/pdf,image/*"
                  label={files.length ? files.join(', ') : 'Meal plan PDF'}
                  hint="PDF or image, up to 10 MB"
                  icon="file"
                  onFiles={(fs) => setFiles(fs.map((f) => f.name))}
                />
              </div>
            </Section>

            <Section title="Feedback">
              <Label>Progress</Label>
              <div className="stack-sm">
                <ProgressBar value={0.69} label="Protein" height={8} />
                <ProgressBar value={0.34} color={memberColorVar('blue')} label="Goal" />
                <ProgressBar value={0.6} color={memberColorVar('orange')} label="Thanos" />
              </div>
              <Label>Week dots</Label>
              <WeekDots
                label="Week 3"
                items={[
                  { label: 'U', state: 'done' },
                  { label: 'L', state: 'missed' },
                  { label: 'P', state: 'today' },
                  { label: 'P', state: 'upcoming' },
                  { label: 'L', state: 'upcoming' },
                ]}
              />
              <Label>Banners</Label>
              <div className="stack-sm">
                <Banner tone="info">Demo mode: data stays on this device.</Banner>
                <Banner tone="warn" title="Offline" action={<Button size="sm" variant="secondary">Retry</Button>}>
                  Changes will sync when you are back online.
                </Banner>
                <Banner tone="danger" role="alert">
                  Some changes could not be saved.
                </Banner>
                {banner ? (
                  <Banner tone="accent" title="New PR!" onDismiss={() => setBanner(false)}>
                    Bench press 80 kg × 8. Tap to share with the squad.
                  </Banner>
                ) : null}
                <Banner tone="good">Meal plan is active.</Banner>
              </div>
              <Label>Empty state</Label>
              <EmptyState icon="scale" title="No weigh-ins yet" body="Log your first weight to start the trend line." action={<Button size="sm" icon="plus">Log weight</Button>} compact />
              <Label>Loading</Label>
              <div className="devui__skel">
                <Skeleton width={40} height={40} radius={20} />
                <div className="stack-sm" style={{ flex: 1 }}>
                  <Skeleton width="60%" height={12} />
                  <Skeleton width="85%" height={10} />
                </div>
                <Spinner />
                <Spinner size={16} />
              </div>
            </Section>

            <Section title="Overlays & delight" subtitle="Sheet, confirm, toasts, confetti">
              <div className="devui__wrap">
                <Button variant="secondary" icon="scale" onClick={() => setSheet('log')}>
                  Log weight sheet
                </Button>
                <Button variant="secondary" onClick={() => setSheet('full')}>
                  Full sheet
                </Button>
                <Button variant="secondary" onClick={() => setSheet('plain')}>
                  Non-dismissible
                </Button>
                <Button variant="danger" icon="trash" onClick={() => setSheet('confirm')}>
                  Delete workout
                </Button>
              </div>
              <Label>Toasts</Label>
              <div className="devui__wrap">
                <Button variant="ghost" size="sm" onClick={() => toast('Saved')}>
                  Default
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast('Weight logged: 80.7 kg', { tone: 'good' })}>
                  Good
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast('Could not reach the server', { tone: 'danger' })}>
                  Danger
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast('Set deleted', { action: { label: 'Undo', onClick: () => toast('Restored', { tone: 'good' }) } })}>
                  With action
                </Button>
              </div>
              <Label>Celebrate</Label>
              <div className="devui__wrap">
                <Button variant="tonal" icon="sparkles" onClick={() => celebrate()}>
                  Small burst
                </Button>
                <Button variant="tonal" icon="trophy" onClick={() => celebrate({ intensity: 'big' })}>
                  Big celebration
                </Button>
              </div>
            </Section>

            <Section title="Headers">
              <div className="stack-lg">
                <PageHeader eyebrow="3 members · BTS week 3" title="Squad" actions={<AvatarStack members={SQUAD.slice(0, 3)} size={32} />} />
                <PageHeader eyebrow="Stelios · Cut phase" title="Body" back="/" actions={<IconButton icon="more" label="More" variant="ghost" />} />
                <PageHeader title="Neutral-grip lat pulldown history" subtitle="Stelios · 12 sessions" back />
                <SectionTitle eyebrow="This week" title="Squad pulse" action={<CardLink to="/squad">See all</CardLink>} />
              </div>
            </Section>

            <Section title="Type & tokens">
              <div className="devui__type">
                <p className="eyebrow">Eyebrow · Thu 24 Sep · Week 3 of 12</p>
                <p className="micro">Micro label · Sets · Kg</p>
                <p style={{ font: '800 18px/22px var(--font-body)', letterSpacing: '-0.015em' }}>Neutral-Grip Lat Pulldown</p>
                <p className="ink-2" style={{ font: '600 14px/19px var(--font-body)' }}>
                  Body text in Manrope. Γεια σου Στέλιο, καλή προπόνηση! <span className="num" style={{ fontSize: 18 }}>55<i className="mul">×</i>10</span>
                </p>
              </div>
              <Label>Surfaces & ink</Label>
              <div className="devui__swatches">
                {['--bg', '--surface', '--surface-2', '--surface-3', '--seg-on', '--line', '--line-strong', '--ink', '--ink-2', '--muted', '--faint'].map((n) => (
                  <Swatch key={n} name={n} />
                ))}
              </div>
              <Label>Accent & status</Label>
              <div className="devui__swatches">
                {['--accent', '--accent-strong', '--accent-soft', '--on-accent', '--good', '--good-soft', '--warn', '--warn-soft', '--danger', '--danger-soft'].map((n) => (
                  <Swatch key={n} name={n} />
                ))}
              </div>
              <Label>Members</Label>
              <div className="devui__swatches">
                {['--m-blue', '--m-orange', '--m-aqua', '--m-yellow', '--m-magenta', '--m-green', '--m-violet', '--m-red'].map((n) => (
                  <Swatch key={n} name={n} />
                ))}
              </div>
            </Section>

            <Section title="Icons" subtitle={`${ICON_NAMES.length} glyphs · 24 px grid · 1.8 stroke`}>
              <div className="devui__icons">
                {ICON_NAMES.map((n) => (
                  <div key={n} className="devui__icon" title={n}>
                    <Icon name={n} size={24} />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>

      <Sheet
        open={sheet === 'log'}
        onClose={() => setSheet(null)}
        title="Log weight"
        subtitle="Thu 24 Sep · 07:40"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSheet(null)}>
              Cancel
            </Button>
            <Button
              icon="check"
              onClick={() => {
                setSheet(null)
                toast(`Weight logged: ${weight.toFixed(1)} kg`, { tone: 'good' })
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="stack-lg" style={{ alignItems: 'center', paddingTop: 8 }}>
          <Stepper label="Body weight" size="lg" value={weight} onChange={setWeight} step={0.1} min={30} max={250} unit="kg" />
          <div style={{ width: '100%' }}>
            <TextField label="Note" placeholder="After breakfast, felt light" />
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === 'full'} onClose={() => setSheet(null)} title="Warm-up, swaps & notes" subtitle="Neutral-Grip Lat Pulldown" size="full">
        <div className="stack">
          {Array.from({ length: 14 }, (_, i) => (
            <Card key={i} padding="sm">
              <p style={{ font: '800 14px var(--font-body)' }}>Swap option {i + 1}</p>
              <p className="muted" style={{ font: '600 12px var(--font-body)' }}>
                Machine · Hammer Strength
              </p>
            </Card>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'plain'}
        onClose={() => setSheet(null)}
        dismissible={false}
        title="Finish workout?"
        footer={
          <Button block onClick={() => setSheet(null)}>
            Got it
          </Button>
        }
      >
        <p className="ink-2" style={{ font: '600 14px/20px var(--font-body)' }}>
          This one has no close button, Esc or backdrop: only the footer action closes it.
        </p>
      </Sheet>

      <ConfirmSheet
        open={sheet === 'confirm'}
        danger
        title="Delete this workout?"
        body="Pull · Week 3. The sets and the PR you logged will be removed for the whole squad."
        confirmLabel="Delete"
        onConfirm={() => new Promise((r) => setTimeout(r, 700)).then(() => toast('Workout deleted'))}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}
