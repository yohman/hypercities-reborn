# Browser verification · 2026-10-30

Verified in the Codex in-app browser at its normal right-panel viewport (857 × 988).

- The local entry point responds with HTTP 200 and renders Cesium's 3D scene.
- Eight historical map rasters are present locally; selecting the 1945 damage map reports a cached Geoportal Berlin raster.
- 3,335 OSM footprints load as extruded contemporary buildings. An initial rhumb-line geometry error was fixed by using geodesic polygon edges and cleaning degenerate rings. No subsequent render-stop error was observed.
- Native keyboard input changes flight altitude (1.65 km → 1.68 km in the test).
- Walk settles to approximately 1.75 m above the simplified ground. Native W input changes the coordinate readout while maintaining pedestrian height. Switching back to Fly releases the ground constraint.
- Walk entry uses the place being viewed and finds a nearby street/path outside the local footprint polygons; heading is aligned with the selected street segment.
- The Palast encounter restores 1976, its specified 1986 map, and its saved viewpoint; its local glTF massing model is visible in the 3D scene.
- The local video loads with readyState 4 and a 12-second duration. Clicking its native play control changes paused to false and advances currentTime. Playback is also assigned to the in-world screen.
- The sound encounter loads its local WAV. The spatial-audio control enters its enabled state after an explicit click. Camera-relative direction and radius attenuation are implemented; perceived spatial sound was not independently evaluated by listening.
- Dragging the Timewell changed focal year 1989 → 2053 while the displayed position remained 52.51628° N, 13.37952° E.
- At the span control's minimum, the interface reports “1 SECOND.” At maximum it reports “20,000 YEARS.”
- `500 BCE` displays correctly at second-level scale as “1 JAN · 00:00:00.” A first BCE clock-formatting bug was fixed.
- `10000-01-01T12:34:56` displays year 10000 and the correct clock. `1900-02-29` is rejected as invalid.
- Manual map selection disables map following and preserves the focal year and geographic position. The visible Timewell header identifies the selected map's date separately.
- Collection selection, explicit travel, narrative position, encounter closing, and map-panel opening/closing were exercised.
- JavaScript syntax checks and local asset-integrity checks pass.

Scope limits are documented in README.md and in the interface's source notes. Historical building reconstructions, collision-aware walking, physical terrain, database persistence, live collaboration, mobile touch navigation, and production hosting were not verified or implemented.
