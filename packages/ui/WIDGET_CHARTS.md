# Widget chart rendering

Holo Panels renders widget charts with shared SVG geometry from `widgetChartMarks`, mounted by React, Vue, and Svelte. Category positions align across series, including sparse data; bars support positive and negative values; pie slices share one total across all series. The shared chart protocol supplies the data, description, summary, and tabular accessibility model, so every renderer exposes the same information without adding a chart-library runtime dependency.

This choice keeps the initial renderer bundle small and avoids three framework-specific chart dependencies. The built-in charts intentionally provide only the approved area, bar, line, and pie presentation contract. Applications that need advanced interaction or specialized visualization can register a custom widget renderer without changing the shared protocol.

The SVG is presentation-only. Each chart also renders a semantic data table with a caption and description, which remains the authoritative accessible representation for screen readers and non-visual use. Color is never the only source of meaning because series labels and numeric values are present in the table.
