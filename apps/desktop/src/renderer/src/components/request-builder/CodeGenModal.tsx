import { useMemo, useState } from 'react'
import { Modal, CodeEditor, Button, toast } from '@vayntforge/ui'
import type { CodeEditorLanguage } from '@vayntforge/ui'
import { generateCodeSample, CODE_SAMPLE_LANGUAGES } from '@vayntforge/engine'
import type { CodeSampleLanguage, RequestModel } from '@vayntforge/engine'
import { buildCodeSampleRequest } from '../../lib/codeSample'

const CODE_LANGUAGE: Record<CodeSampleLanguage, CodeEditorLanguage> = {
  curl: 'shell',
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  go: 'go',
}

export function CodeGenModal({ draft, open, onClose }: { draft: RequestModel; open: boolean; onClose(): void }) {
  const [lang, setLang] = useState<CodeSampleLanguage>('curl')
  const sample = useMemo(() => generateCodeSample(buildCodeSampleRequest(draft), lang), [draft, lang])

  const copy = async () => {
    await navigator.clipboard.writeText(sample)
    toast.success('Code sample copied')
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate Code" width="max-w-2xl">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1">
          {CODE_SAMPLE_LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLang(l.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                lang === l.id ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <CodeEditor value={sample} onChange={() => {}} language={CODE_LANGUAGE[lang]} readOnly minHeight="280px" />
        <div className="flex justify-end">
          <Button size="sm" onClick={copy}>
            Copy
          </Button>
        </div>
      </div>
    </Modal>
  )
}
