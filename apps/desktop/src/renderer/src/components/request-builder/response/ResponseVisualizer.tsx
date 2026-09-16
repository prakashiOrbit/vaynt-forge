import { useMemo } from 'react'
import { renderVisualizerHtml } from '@vayntforge/engine'

/**
 * Renders a `pm.visualizer.set(template, data)` result — a small,
 * declarative (no `eval`/`Function`) template engine, then displayed in a
 * fully locked-down `srcdoc` iframe (`sandbox=""`, no `allow-scripts`): the
 * *output* came from a response/script the user doesn't necessarily
 * control, so it gets no script execution, no form submission, no
 * top-navigation, and an opaque origin with no access to this app's APIs.
 */
export function ResponseVisualizer({ visualizer }: { visualizer: { template: string; data: unknown } }) {
  const html = useMemo(() => renderVisualizerHtml(visualizer.template, visualizer.data), [visualizer])

  return (
    <iframe
      title="Response Visualizer"
      sandbox=""
      srcDoc={html}
      className="h-full w-full border-0 bg-white"
    />
  )
}
