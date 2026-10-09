# Validation results

Tested on 9 October 2026 in a Linux workspace, with Node 24 and Python 3.12.

## Passed

- Vite production build: all imports resolved and JSX/CSS compiled.
- All 7 original Python integration tests: health, Golden queue/dispatch, custom booking, reverse direction, disjoint/no-overlap preservation, same-stop rejection, WebSocket heartbeat.
- Frontend adapter test: Golden fares ₹504/₹728/₹868, ₹2,100 sum, canonical node fields, detour fields, merged stop timeline, final occupancy zero, multi-seat occupancy and infeasible-response rejection.
- Browser test against the actual FastAPI backend through the Vite proxy:
  - Passenger booking → queued state → dispatch → single-rider fare/trip result.
  - Golden queue loading and three-passenger dispatch.
  - All six admin sections render.
  - Fairness table, Convenience Shield, fixed Vikram rejection and benchmark fixture.
  - What-If evaluation of existing riders and an additional candidate.
  - Leaflet markers, route layers, fit-route and detour overlay controls.
  - Driver simulation play/pause and displayed occupancy.
  - Failed no-overlap dispatch displays the backend error and preserves both queued requests.
  - No uncaught JavaScript page errors in the final browser run.
  - No page-level horizontal overflow at 390px width in passenger, driver or admin views.
- Visually inspected desktop passenger, driver and fairness pages and mobile passenger layout.
- Compared all original backend Python files against uploaded ZIP bytes: unchanged.

## Environment limits / still check locally

- OpenStreetMap tile requests were unavailable in the test environment. Leaflet route geometry, markers, zoom controls and attribution rendered; actual tile loading must be checked on your internet connection. The UI shows a tile error message while preserving route geometry.
- Device geolocation permission and real coordinates were not exercised.
- Windows batch launchers were reviewed, not executed on Windows.
- No real GPS tracking, driver reservation, payment, private-ride booking or long-duration production reliability testing is claimed.
- The fixed benchmark and Vikram fixtures do not verify real-world routing accuracy. The existing backend uses its original simplified corridor model.

## Reproduce the browser checks

The browser workflow source is provided at tests/browser_smoke.cjs. Install Playwright in a separate test environment and ensure a browser is installed. It starts disposable FastAPI/Vite processes, so run it with your normal project servers stopped and an empty demo queue. See comments at the top for invocation.
