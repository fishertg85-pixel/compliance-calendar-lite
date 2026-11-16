# IronLedger Compliance Calendar (Lite)

Single-file pharmacy compliance calendar. `build.py` inlines `app.css`, `engine.js`, `seed.js`, `holidays.js` and `app1-3.js`.

## Build
```
python3 build.py     # writes index.html (sample-data demo) and calendar_blank.html (empty new pharmacy)
node test.js && node test_hol.js     # engine and holiday tests
python3 smoke_blank.py               # browser test (needs playwright + Chrome)
```

## Two builds
- `index.html`: opens with sample data and a "Start My Pharmacy" banner. Nothing is saved until the pharmacy is started.
- `calendar_blank.html`: sets `window.IL_BLANK=true`. Opens empty on a "Set Up A New Pharmacy" screen. No sample data anywhere.

## Hosting hook (for the AWS reorder app)
If the host page defines `window.ILHOST = { load(): Promise<state|null>, save(state): Promise<void> }` before this page runs, the calendar uses it for storage instead of the browser. `load` returns the saved state (or null for a pharmacy not started yet). `save` is called (debounced, about 0.6 s) with the full state after every change. If `load` fails, nothing is saved and a message shows, so a failed load never overwrites server data.
Without `ILHOST` the calendar uses the Claude artifact database when present, else browser storage (`ilcal.v1`).
