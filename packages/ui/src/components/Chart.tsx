import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ComposeOption } from 'echarts/core'
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts'
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer])

/**
 * A plain object passed straight to `echarts.init` — ECharts accepts a theme
 * object directly, not just a registered name, which matters with the
 * `echarts/core` modular build: the bundled 'dark'/'light' theme *names*
 * aren't registered unless you also import + call `registerTheme` yourself,
 * so a string here would silently render unthemed (dark text on our dark
 * background). Matches the design tokens' dark surface/text/border colors.
 */
const DARK_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#9aa4b2' },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#2a2f37' } },
    axisLabel: { color: '#9aa4b2' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: '#9aa4b2' },
    splitLine: { lineStyle: { color: '#1f2329' } },
  },
  tooltip: {
    backgroundColor: '#181b20',
    borderColor: '#2a2f37',
    textStyle: { color: '#e2e8f0' },
  },
}

/** Registers only the line/bar + grid/tooltip subset `Chart` actually
 * renders, via `echarts/core` — importing all of `echarts` instead measurably
 * bloats the renderer bundle for chart types this app never uses. */
export type EChartsOption = ComposeOption<BarSeriesOption | LineSeriesOption | GridComponentOption | TooltipComponentOption>

export interface ChartProps {
  option: EChartsOption
  height?: number | string
  dark?: boolean
  className?: string
}

/** Thin ECharts wrapper — dense/technical look per the design system. Handles
 * init/dispose, container resize, and re-applying `option` on change. */
export function Chart({ option, height = 220, dark = true, className = '' }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const instance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, dark ? DARK_THEME : undefined, { renderer: 'canvas' })
    instance.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      instance.current = null
    }
  }, [dark])

  useEffect(() => {
    instance.current?.setOption(option, true)
  }, [option])

  return <div ref={ref} className={className} style={{ height, width: '100%' }} />
}
