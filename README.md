# Slate

[Open the whiteboard](https://vmirkvss.github.io/slate-whiteboard/) · [Beginner guide](GETTING-STARTED.md)

A local-first teaching whiteboard built with React 19, strict TypeScript, Vite, Tailwind CSS and Lucide. No account, backend, analytics, or external font requests. Lessons stay in this browser's IndexedDB; export a `.slate` file to move them between devices.

## Run

Use Node.js 22.12+ and pnpm 10.11.0:

```sh
pnpm install
pnpm dev
```

Open the URL Vite prints. For production:

```sh
pnpm build
pnpm exec vite preview
```

Deploy the generated `dist/` directory to any static host. GitHub Pages serves the generated `gh-pages` branch. Run `pnpm deploy` to test, build, and upload a new website version. Source code stays on `main`. An optional manual Actions workflow is included for a later switch to Actions publishing. See [the beginner guide](GETTING-STARTED.md).

## Teaching workflow

- Pen, pressure-sensitive stylus input, smoothing, highlighter, stroke and precision erasers.
- Selection, Shift selection, marquee, move, bottom-right resize handle, Shift proportional resize, duplicate, delete and in-app copy/paste.
- Line, arrow, rectangle, ellipse, plus circle, rounded rectangle and triangle in More tool options.
- Multiline text with alignment; double-click text to edit. Select text and use Tool options to change font size.
- PNG/JPEG/WebP import from file, drop or clipboard. Imported images are reduced to a maximum 2048-pixel edge.
- Pan with Space + drag or the hand tool. Scroll to pan; Ctrl/Cmd + scroll or a trackpad pinch to zoom around the pointer. Touch pinch supports zoom and translation.
- Create, rename, reorder, duplicate and delete lesson pages. Each page retains its camera. Open the title dropdown for the local board library and native import.
- Dark/light themes, dot/square/blank backgrounds, custom canvas colors, pen presets, thickness, smoothing and export resolution.
- Teaching mode hides the document controls and keeps drawing tools available. Press F to enter, Escape to leave.
- PNG at 1×–3×, SVG vectors, A4/Letter landscape PDF (current or all pages), and editable version-1 JSON `.slate` backups. PNG/SVG can have transparent backgrounds.

Shortcuts: V select, P pen, E eraser, H highlighter, L line, R rectangle, O ellipse, A arrow, T text, Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z redo, Cmd/Ctrl+D duplicate, Cmd/Ctrl+A select all, Cmd/Ctrl+C/V in-app copy/paste, Cmd/Ctrl+S save, Delete remove selection. Shortcuts do not intercept text fields.

## Architecture and tradeoffs

A custom Canvas 2D engine was retained from the existing workspace. Excalidraw was considered for its mature object interaction and editing behavior; integrating its document/UI model would add substantial complexity to this deliberately small teaching surface. SVG/DOM rendering would simplify accessible individual objects, but thousands of nodes and pressure segments would increase layout/DOM work. Custom Canvas provides direct control over stylus latency and a small initial bundle, at the cost of owning selection, hit testing and exports. This is a scoped editor, not a claim of feature parity with mature drawing engines.

`model.ts` owns the versioned document, coordinates, hit testing and bounded history. `Canvas.tsx` owns pointer lifecycle and rendering scheduling. `render.ts` draws objects and caches immutable bounds. `storage.ts` wraps IndexedDB transactions. `export.ts` and `export.worker.ts` handle file output. `App.tsx` coordinates document/UI state; `style.css` contains the responsive design system.

- Two canvas layers separate committed content from active strokes. Pen segments render incrementally via requestAnimationFrame. Pointer samples and pressure live outside React state. Coalesced input is used with a single-event fallback; cancellation rolls back an in-flight action.
- Highlighters redraw their active path to prevent accumulating opacity. Camera changes use viewport culling and weakly keyed bounds caches. DPR is capped at 2.5 to bound buffers.
- History retains at most 80 immutable arrays of object references per page. Unchanged strokes are shared; only edits allocate new geometry. This avoids deep-copying every point for every action, though array history still scales with object count.
- Weak image/bounds caches follow document object lifetime. Canvas buffers, event listeners, animation frames, download object URLs and export workers are released.
- Autosave batches meaningful changes with a 500 ms debounce. IndexedDB transactions are atomic, so an interrupted write retains the prior committed document. A visibility change requests a flush; closing while saving warns where the browser supports it. Storage errors stay visible. Browser eviction, private-mode restrictions and a sudden process kill can still lose unsaved work: native backups are the portable recovery mechanism.
- SVG generation runs in a short-lived worker; PNG rasterizes the resulting SVG after image loading. PNG limits are 8192 pixels per edge and 32 megapixels. PDF is lazy-loaded and yields every 250 objects. Text and shapes remain vectors in PDF.
- The native validator limits pages, points, coordinates, widths, text, embedded image types, duplicate identifiers and schema version. Documents are never placed in localStorage; only small preferences are.

## Verification

```sh
pnpm test
pnpm exec playwright install chromium
# Keep pnpm dev running in another terminal:
pnpm test:e2e
```

Vitest covers native round trips, validation, coordinate transforms, pointer-anchored zoom, segment hit testing, immutable movement, bounded undo/redo and SVG escaping/geometry. Playwright covers actual drawing, erasing, reload recovery, text, pages, selection/resize, keyboard shortcuts, downloads and native re-import, synthetic stylus input/cancellation, mobile layout and large-document profiling. Browser tests use isolated contexts and do not touch your own browser lessons.

`benchmark-results.json` records a real synthetic run on an Apple M5, 16 GB RAM, macOS, headless Chromium 156, 1440×1000 at DPR 1. Each stroke has 24 points laid out across a large world; much content is culled. The benchmark measures initial Canvas API submission, mean camera draw-call submission over 15 iterations, hit testing, IndexedDB transaction completion and synchronous SVG serialization. It is not a GPU frame-rate benchmark or an end-to-end latency measurement. Reruns overwrite the results with current measurements.

The initial production JavaScript was approximately 85 KB gzip, plus 5 KB gzip CSS; PDF and export code are loaded on demand. See the build output for exact current sizes.

## Known limits and device testing

- A real graphics tablet and real multi-touch hardware were not available for testing. Automated Chromium pen events verify pressure plumbing, not actual driver latency, palm rejection or handwriting feel. Before a long lesson, verify slow diagonals, tiny superscripts, varying pressure, pen+touch, pointer cancellation and display scaling on your hardware.
- No claim of sustained 60 FPS or leak-free hours-long sessions is made. The included benchmark does not measure compositor time, end-to-end pointer latency, retained heap or long-session memory growth. Dense all-visible drawings and very long highlighter paths need further device profiling.
- Precision erasing splits sampled freehand paths; it does not boolean-cut shapes or images. Hit testing for closed shapes uses their bounds. Text bounds are estimated and fonts are browser-provided. There is no rotation or rich-text formatting.
- PDF uses the built-in Helvetica encoding; arbitrary Unicode typed mathematics/CJK/emoji is not reliably represented. Handwritten math remains vector geometry. Use PNG/SVG for exact browser-rendered Unicode text. SVG text remains editable text and can vary if recipient fonts differ.
- Export preparation is off-thread/batched where practical, but worker structured cloning, PDF final serialization and IndexedDB cloning can still pause very large documents. Image-heavy documents consume more memory and storage than the stroke-only benchmark.
- Copy/paste of drawing objects is within the current app session; image paste uses the system clipboard. Undo history is session-only. Canvas objects themselves are not exposed as a keyboard-readable accessibility tree; surrounding controls are labeled and keyboard reachable.
- Local-only persistence is not a cloud backup or real-time collaboration system. Browsers may evict storage. Import is limited to 40 MB and 2 million points; image files to 20 MB. Keep exported backups of important lessons.
