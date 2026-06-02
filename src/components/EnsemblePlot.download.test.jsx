// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockDownloadImage, plotPropsSpy, mockGraphDiv } = vi.hoisted(() => ({
  mockDownloadImage: vi.fn(),
  plotPropsSpy: vi.fn(),
  mockGraphDiv: { id: 'plot-div' },
}))

vi.mock('plotly.js-dist-min', () => ({
  default: {
    downloadImage: mockDownloadImage,
  },
}))

vi.mock('react-plotly.js/factory', () => ({
  default: () =>
    function MockPlot(props) {
      plotPropsSpy(props)
      props.onInitialized?.({}, mockGraphDiv)
      return <div data-testid="plotly-plot" />
    },
}))

import EnsemblePlot from './EnsemblePlot.jsx'

describe('EnsemblePlot downloads', () => {
  beforeEach(() => {
    mockDownloadImage.mockClear()
    plotPropsSpy.mockClear()
  })

  it('lets the user choose the file type for plot downloads', () => {
    render(
      <EnsemblePlot
        rows={[{ year: 2020, traceA: 1 }]}
        indexColumn="year"
        columns={['traceA']}
        labelsByColumn={{ traceA: {} }}
        colorBy={null}
        colorMap={{}}
        visibleColumns={new Set(['traceA'])}
        showBands={false}
        indexType="numeric"
        xAxisLabel=""
        yAxisLabel=""
        defaultYAxisLabel=""
        lineStyleControls={{ thickness: 1, opacity: 1, widthOverride: null, opacityOverride: null }}
        tickFormat={{ x: 'auto', y: 'auto' }}
        axisRanges={{}}
      />
    )

    const formatSelect = screen.getByLabelText(/download as/i)
    expect(formatSelect.value).toBe('svg')

    fireEvent.change(formatSelect, { target: { value: 'png' } })
    fireEvent.click(screen.getByRole('button', { name: /download plot/i }))

    expect(mockDownloadImage).toHaveBeenCalledWith(mockGraphDiv, {
      format: 'png',
      filename: 'ensemble',
    })
  })

  it('removes the default Plotly image button in favor of the format picker', () => {
    render(
      <EnsemblePlot
        rows={[{ year: 2020, traceA: 1 }]}
        indexColumn="year"
        columns={['traceA']}
        labelsByColumn={{ traceA: {} }}
        colorBy={null}
        colorMap={{}}
        visibleColumns={new Set(['traceA'])}
        showBands={false}
        indexType="numeric"
        xAxisLabel=""
        yAxisLabel=""
        defaultYAxisLabel=""
        lineStyleControls={{ thickness: 1, opacity: 1, widthOverride: null, opacityOverride: null }}
        tickFormat={{ x: 'auto', y: 'auto' }}
        axisRanges={{}}
      />
    )

    const plotProps = plotPropsSpy.mock.calls.at(-1)?.[0]
    expect(plotProps.config.modeBarButtonsToRemove).toContain('toImage')
  })
})
