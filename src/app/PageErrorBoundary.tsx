import { Component, type ErrorInfo, type ReactNode } from 'react'
import { defineMessages, useT } from '../i18n'
import { Button, EmptyState } from '../ui'
import { isChunkLoadError } from './appUpdate'

const M = defineMessages({
  title: 'This screen didn’t open',
  body: 'Something went wrong here. Your logged data is safe. Reload the app to try again.',
  offline: 'You seem to be offline and this screen isn’t saved on the phone yet. Try again when you have a connection.',
  reload: 'Reload',
})

function PageError({ error }: { error: unknown }) {
  const t = useT(M)
  const offline = isChunkLoadError(error) && typeof navigator !== 'undefined' && navigator.onLine === false
  return (
    <div className="app-page-error" role="alert">
      <EmptyState
        icon="alert"
        title={t('title')}
        body={offline ? t('offline') : t('body')}
        action={
          <Button variant="primary" icon="refresh" onClick={() => location.reload()}>
            {t('reload')}
          </Button>
        }
      />
    </div>
  )
}

interface Props {
  children: ReactNode
  /** When this changes (e.g. the route path), a shown error is cleared and the children render again. */
  resetKey?: string
}

/**
 * Keeps one broken screen from blanking the whole app: the tab bar and the rest of the shell stay usable.
 * AppShell passes the route path as resetKey, so navigating elsewhere clears the error (without remounting
 * pages on every path change, which a `key` would do).
 */
export class PageErrorBoundary extends Component<Props, { error: unknown }> {
  state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('Unknown error') }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ect] page crashed', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    return this.state.error ? <PageError error={this.state.error} /> : this.props.children
  }
}
