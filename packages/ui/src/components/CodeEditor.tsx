import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'
import { python } from '@codemirror/lang-python'
import { StreamLanguage } from '@codemirror/language'
import { java } from '@codemirror/legacy-modes/mode/clike'
import { go } from '@codemirror/legacy-modes/mode/go'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { oneDark } from '@codemirror/theme-one-dark'

export type CodeEditorLanguage =
  | 'json'
  | 'xml'
  | 'html'
  | 'javascript'
  | 'graphql'
  | 'python'
  | 'java'
  | 'go'
  | 'shell'
  | 'text'

export interface CodeEditorProps {
  value: string
  onChange(value: string): void
  language?: CodeEditorLanguage
  minHeight?: string
  maxHeight?: string
  readOnly?: boolean
  placeholder?: string
}

function languageExtension(language: CodeEditorLanguage) {
  switch (language) {
    case 'json':
      return [json()]
    case 'xml':
      return [xml()]
    case 'html':
      return [html()]
    case 'javascript':
    case 'graphql':
      return [javascript()]
    case 'python':
      return [python()]
    case 'java':
      return [StreamLanguage.define(java)]
    case 'go':
      return [StreamLanguage.define(go)]
    case 'shell':
      return [StreamLanguage.define(shell)]
    default:
      return []
  }
}

const chromeTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--af-bg-input)', fontSize: '12px' },
  '.cm-content': { fontFamily: 'var(--af-font-mono)', padding: '8px 0' },
  '.cm-gutters': {
    backgroundColor: 'var(--af-bg-input)',
    color: 'var(--af-text-faint)',
    border: 'none',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--af-font-mono)' },
})

function isDarkNow(): boolean {
  return document.documentElement.getAttribute('data-theme') !== 'light'
}

/** Watches the app's `data-theme` attribute so the editor follows Dark/Light/System. */
function useIsDark(): boolean {
  const [dark, setDark] = useState(isDarkNow)
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkNow()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return dark
}

/** Shared CodeMirror 6 wrapper — the roadmap's documented "lighter alt" to Monaco. */
export function CodeEditor({
  value,
  onChange,
  language = 'text',
  minHeight = '120px',
  maxHeight,
  readOnly = false,
  placeholder,
}: CodeEditorProps) {
  const dark = useIsDark()
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={dark ? oneDark : 'light'}
        extensions={[...languageExtension(language), chromeTheme]}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={{ foldGutter: true, highlightActiveLine: !readOnly }}
        height="auto"
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
    </div>
  )
}
