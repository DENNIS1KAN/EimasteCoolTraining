import { lazy, Suspense, useMemo } from 'react'
import { useParams } from 'react-router'

/**
 * Development-only playgrounds (not linked in the UI, excluded from production routing).
 * Any file src/dev/pages/<name>.tsx with a default export is reachable at #/dev/<name>.
 */
const pages = import.meta.glob('./pages/*.tsx') as Record<string, () => Promise<{ default: React.ComponentType }>>

export default function DevPage() {
  const { page = '' } = useParams()
  const Comp = useMemo(() => {
    const loader = pages[`./pages/${page}.tsx`]
    return loader ? lazy(loader) : null
  }, [page])
  if (!Comp) return <div style={{ padding: 24 }}>Dev pages: {Object.keys(pages).map((k) => k.slice(8, -4)).join(', ') || 'none'}</div>
  return (
    <Suspense fallback={null}>
      <Comp />
    </Suspense>
  )
}
