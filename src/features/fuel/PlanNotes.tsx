import { Fragment, useMemo } from 'react'
import { parseNotes } from './lib/notes'

/** Coach notes with the tiny markup: "# " headings, "- " bullets, blank lines between paragraphs. */
export function PlanNotes({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseNotes(text), [text])
  if (!blocks.length) return null
  return (
    <div className={`fu-notes${className ? ` ${className}` : ''}`}>
      {blocks.map((b, i) =>
        b.kind === 'heading' ? (
          <h3 key={i} className="fu-notes__h">
            {b.text}
          </h3>
        ) : b.kind === 'list' ? (
          <ul key={i} className="fu-notes__ul">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="fu-notes__p">
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {l}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  )
}
