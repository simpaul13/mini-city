# Recovery status and verification

Implemented: legacy terrain fixture and unversioned save fixture; deterministic generator extraction and version selection; configurable version-2 chunk size and streaming radius; independent version-2 rock candidates; shared placement checks including funds; road neighbor data; input timing and save shortcuts; save validation and migration; actual IndexedDB transaction tests using fake-indexeddb; per-tile version-2 render refresh.

Partial: the session coordinator and world facade remain large; generated chunk caching, shared renderer resources, per-chunk player indexes and incremental totals are missing. Version-2 generation does not yet implement moisture layers and lakes. Road links are rendered but the complete requested rendering architecture and performance instrumentation are not in place. Input subscriptions are not yet centralized or fully disposable. Chromium smoke checks exercised the toolbar, settings, save/load and repeated menu transitions without page errors; a separate check confirmed Ctrl+S and Cmd+S. A legacy browser save restored a house, population 4 and treasury 12,300. These checks do not establish successful placement of every building, road dragging, or GPU counts.

Deferred: traffic, utilities, taxation, citizens, fluid simulation, bridges, multi-tile buildings and redesign.

Next: split lifecycle, UI and input from Game; extract chunk streaming and renderer ownership; add bounded immutable data cache and resource accounting; finish generation layers; expand browser tests and legacy vegetation fixtures. Run `npm test` and `npm run build` after each extraction.
