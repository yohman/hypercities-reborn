# Hypercities Reborn

An immersive Berlin interface prototype for HyperCities, built with CesiumJS. Walk or fly through historical maps and situated narratives, and explore deep time with the Timewell.

[Open Hypercities Reborn](https://yohman.github.io/hypercities-reborn/) · [GitHub repository](https://github.com/yohman/hypercities-reborn)

No accounts, backend, database, or ion token are needed. The original HyperCities site remains a separate project.

## Run locally

From this directory:

```sh
python3 -m http.server 4381 --bind 127.0.0.1
```

Open <http://127.0.0.1:4381/>. WebGL 2 is required. Eight historical rasters, building and path geometry, Cesium, and demonstration media are local. Contemporary dark, street, and satellite basemaps use online services and retain attribution.

## Explore

- **Fly:** drag to navigate, right-drag to look, WASD to move, Q/E to change altitude, Shift to move faster. Arrow keys turn/look. The up/down controls also change altitude.
- **Walk:** descends toward the geographic center of the view and snaps to a nearby mapped street or footpath outside contemporary footprints. WASD moves at pedestrian height, drag or arrows look, and “Look around” optionally captures the pointer. Escape releases it. Fly releases the ground constraint.
- **Collection:** select any encounter to inspect it without moving. “Enter this moment” restores its camera, historical time, historical layer, and preferred contemporary basemap. Follow/Continue advances the sequence; wandering does not reset the sequence.
- **Timewell:** drag to scrub; wheel or the continuous logarithmic span control scales from 20,000 years to one second. +/- narrows/widens the span. The focal moment remains stable when zooming. The expanded section gives objects more room. Overlapping encounters cluster at broad scales. Intervals stay discoverable when their start lies outside the visible span. Map dates occupy a separate track. Exact input supports signed astronomical years and forms such as `500 BCE`.
- **Maps:** select one of eight historical layers, adjust opacity, change contemporary ground, or disable “Follow time.” Clicking a map in the Timewell selects that map without changing historical time or moving the camera.
- **Media:** the video plays in its panel and on its situated screen. Sound has an ordinary player and optional camera-relative stereo direction/distance attenuation, fading to silence beyond 140 m. No media autoplays.

## Collection and sources

`data/collection.js` contains six encounters across the Spree, Brandenburg Gate, Unter den Linden, Potsdamer Platz, and Schlossplatz. It preserves object position, elevation above the simplified surface, scale, dates, saved camera, layers, and source notes separately.

Historical context is based on the source links in each encounter: Berlin.de for the Gate, Bundesarchiv for the Palast, bpb for 1989, and the historical maps themselves. The 1650 and 1910 encounters are editorial readings of maps, not claims about a precisely timed event.

Historical maps:

| Asset | Source | Date |
| --- | --- | --- |
| Berlin / Memhard | HyperCities, UCLA map library, map:18 | 1650 |
| Royal residence city | HyperCities, UCLA map library, map:26 | 1805 |
| Pharus-Plan Berlin | HyperCities, UCLA map library, map:1 | 1905 |
| Berlin circa 1910 | Geoportal Berlin, Städtebauliche Entwicklung | 1910 |
| Building damage | Geoportal Berlin, Städtebauliche Entwicklung | 1945 |
| Berlin after the war | HyperCities, UCLA map library, map:8 | 1947 |
| Capital of the GDR | HyperCities, UCLA map library, map:38 | 1986 |
| Berlin circa 1986 | Geoportal Berlin, Städtebauliche Entwicklung | 1986 |

The selected original catalog records are retained in `data/hypercities-berlin.json`. `assets/manifest.json` records raster endpoints, extents, and projection. HyperCities tile mosaics use a small Berlin extent at zoom 14. Tile rows and projected WMS rasters were resampled from Web Mercator onto a geographic latitude grid for Cesium's single-tile provider. Outside the 1650 sheet, transparent atlas cells represent absent sheet coverage. Cached resolution is intentionally limited; a production viewer should stream source tiles across zoom levels.

Footprints and street/path lines were retrieved from the OpenStreetMap map API on 2026-10-30. © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Buildings retain `heightSource` metadata: recorded heights where available, otherwise estimates from floor counts or a 16 m default. Geometry is simplified to closed outer rings; some courtyard holes and multipolygon geometry are omitted. These are contemporary context, not historical buildings.

## Deliberately simulated

- `assets/palast-study.gltf`: an original approximate 180 × 85 × 32 m architectural massing model, not a survey or historical reconstruction. Contemporary footprints immediately around it are hidden while the model is active, to make the comparison legible. The active interval is 1976–1990, opening to closure; this does not assert that the building ceased to exist in 1990.
- `assets/map-study.mp4`: a newly made 12-second animation of the 1905 Pharus map, not archival film. Narrative setting: circa 1910. Its in-world screen is 28 × 16 m, deliberately enlarged for this interface study.
- `assets/threshold-study.wav`: an original synthetic sound composition, not an archival recording or reconstructed 1989 soundscape. Description: low pulses and irregular bell-like tones. A 140 m listening radius is a prototype choice.
- Terrain is a smooth ellipsoid, with a nominal pedestrian height of 1.75 m. Local street snapping improves entry; movement does not model collisions, stairs, bridges, interiors, or period-specific terrain. Visitors can pass through buildings.
- Map dates and historical focal time are independent. A 1986 map may accompany a 1976 narrative viewpoint and is labeled accordingly.
- Temporal storage is UTC in a proleptic Gregorian calendar. Display uses BCE/CE without year zero; signed exact input uses astronomical year numbering. Date precision is recorded independently of the control's one-second resolution. Out-of-period encounters remain as subdued discovery cues; the Palast volume itself is visible only in its authored interval.

## Files

- `index.html`, `style.css`: interface and responsive layout.
- `app.js`: Cesium scene, navigation, map layers, encounters, audio, and Timewell.
- `data/collection.js`: editable narrative fixture.
- `data/buildings.geojson`, `data/streets.geojson`: OSM geometry snapshots and provenance.
- `prepare-assets.py`: reproducible raster caching/reprojection, massing-model generation, and synthetic sound generation. Requires Pillow. Existing cached HyperCities rasters are reused. The original selected map catalog is retained locally.
- `vendor/`: CesiumJS 1.121.0, its Apache 2.0 license, and third-party notices. Downloaded from the npm registry; no runtime build or package installation is required.

The map-study movie can be regenerated with FFmpeg:

```sh
ffmpeg -i assets/hc-1905.jpg -vf "zoompan=z='1.0+0.0008*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=300:s=960x576:fps=25,format=yuv420p" -t 12 -c:v libx264 -crf 24 -movflags +faststart assets/map-study.mp4
```
