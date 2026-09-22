import { useState } from 'react'

/**
 * Local text for an input bound to a stored value: typing updates the draft at once, and a change that
 * arrives from elsewhere (another device) replaces the draft only while the field is not being edited.
 * `required`: leaving the field empty puts the stored value back on blur.
 */
export function useDraft(value: string, opts: { required?: boolean } = {}) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (!editing) setDraft(value)
  }
  return {
    draft,
    setDraft,
    bind: {
      onFocus: () => setEditing(true),
      onBlur: () => {
        setEditing(false)
        if (opts.required && draft.trim() === '') setDraft(value)
      },
    },
  }
}
