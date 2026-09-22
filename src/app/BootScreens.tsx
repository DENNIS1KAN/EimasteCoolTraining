import { useStore } from '../data/store'

export function BootScreen({ quiet }: { quiet?: boolean }) {
  return <div className="boot" aria-busy="true">{quiet ? null : <div className="boot__mark">EC</div>}</div>
}

export function ErrorScreen() {
  const err = useStore((s) => s.bootError)
  return (
    <div className="boot boot--error" role="alert">
      <p>{err || 'Something went wrong.'}</p>
      <button onClick={() => location.reload()}>Reload</button>
    </div>
  )
}
