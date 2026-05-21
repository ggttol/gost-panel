import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'

const theme = EditorView.theme(
  {
    '&': {
      fontSize: '12px',
      backgroundColor: 'transparent',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.55',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--color-muted)',
      paddingRight: '6px',
    },
    '.cm-content': { caretColor: 'var(--color-accent)' },
    '.cm-cursor': { borderLeftColor: 'var(--color-accent)' },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-accent-soft) !important',
    },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-line': { padding: '0 6px' },
    '.cm-foldGutter .cm-gutterElement': { opacity: 0.55 },
  },
  { dark: false },
)

export function EditorJson({
  value,
  onChange,
  readOnly,
  height = '320px',
}: {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  height?: string
}) {
  const extensions = useMemo(() => [json(), theme, EditorView.lineWrapping], [])
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden bg-[var(--color-surface)]">
      <CodeMirror
        value={value}
        height={height}
        extensions={extensions}
        onChange={onChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
      />
    </div>
  )
}
