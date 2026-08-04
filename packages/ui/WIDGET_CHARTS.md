# Widget chart rendering

Holo Panels renders widget charts with a small framework-native SVG implementation in React, Vue, and Svelte. The shared chart protocol supplies the data, description, summary, and tabular accessibility model, so every renderer exposes the same information without adding a chart-library runtime dependency.

This choice keeps the initial renderer bundle small and avoids three framework-specific chart dependencies. The built-in charts intentionally provide only the approved area, bar, line, and pie presentation contract. Applications that need advanced interaction or specialized visualization can register a custom widget renderer without changing the shared protocol.

The SVG is presentation-only. Each chart also renders a semantic data table with a caption and description, which remains the authoritative accessible representation for screen readers and non-visual use. Color is never the only source of meaning because series labels and numeric values are present in the table.
