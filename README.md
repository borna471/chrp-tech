# Chrp Home Capture

A mobile web capture flow for a home insurance photo assessment. A homeowner
opens a texted link, works through the 15 photos the assessment needs, and a
reviewer checks each shot as it arrives — sometimes asking for a close-up before
accepting it.

Ported from the Claude Design prototype `Chrp Home Capture.dc.html` in the
**ChrpTech Home Inspection App** project. The design links the Broadsheet design
system but overrides its tokens wholesale with the Chrp navy/aqua palette and
Poppins, so only Broadsheet's button semantics survive here; the palette lives in
`app/globals.css`.

```bash
npm run dev          # http://localhost:3000 — size the viewport to a phone
npm run type-check
npm run lint
npm run build
```

## Layout

```
content/photo-tasks.json        THE PHOTO LIST — edit this to change items or wording
content/README.md               Field-by-field guide to that file
app/page.tsx                    Client root: picks home / capture / done
components/                     AppHeader, HomeScreen, CaptureScreen, DoneScreen, Button
lib/useInspection.ts            The flow's state machine and its derived view values
lib/tasks.ts                    Loads and validates the content file
lib/demoConfig.ts               Who this demo opens as
lib/data/                       Persistence seam (see below)
lib/ai/analyzePhoto.ts          Photo-review seam (see below)
prisma/schema.prisma            The intended relational model — NOT wired up yet
```

## The two seams

Both of the pieces a production build needs are isolated behind one file each, so
neither swap reaches into the UI.

### Persistence — `lib/data/`

`InspectionRepository` (`lib/data/repository.ts`) is the interface every read and
write goes through; entities are in `lib/data/types.ts`. The only adapter today is
`browserRepository`, which keeps records in `localStorage` and photo bytes in
IndexedDB, so the demo runs with no infrastructure and survives a refresh.

`prisma/schema.prisma` mirrors those entities as Postgres tables. **It is not
active** — there is no Prisma dependency, no generated client and no migration.
Going live is: install Prisma, run `prisma migrate dev`, add a
`prismaRepository` implementing the interface, and select it in
`lib/data/index.ts`. Photo bytes belong in object storage, not Postgres —
`PhotoCapture.storageKey` is the field that points at them either way.

### Photo review — `lib/ai/analyzePhoto.ts`

`analyzePhoto()` is the one place the flow decides whether a photo passed. Today
its body is a mock: a delay, then a hardcoded verdict. The file carries the
marked `TODO(ai)` describing the real shape — `POST` the photo to a route handler
that calls the vision model server-side, where the API key can live, and return
the same `AnalyzePhotoResult`. Callers already `await` it and already render a
retryable error state, so replacing the mock touches no other file.

## Editing the photo list

`content/photo-tasks.json` is the list — 20 items covering the water and fire
exposures an insurer cares about, each with the title, the zone, the risk
category, the instruction shown while shooting, and the "make sure we can see"
bullets. Edit it, reload, done: no code change, and an assessment already in
progress keeps its captured photos while picking up the new wording. Removing an
item drops it and its photos; adding one appends it as pending. A malformed entry
fails loudly on load, naming the item. See `content/README.md`.

## Demo behavior worth knowing

- The assessment opens with 3 of 20 photos already captured.
- "Capture photo" opens the real camera/file picker. If nothing comes back within
  900 ms — the usual case on a desktop — the flow stands in a placeholder photo so
  it stays walkable.
- Items carrying a `followUpPrompt` — Water heater and Under the kitchen counter —
  always draw a follow-up request on the first shot; the second shot is accepted.
- Skipped photos are not revisited; the home screen chases them with a banner.
- "Start this demo over" in the home footer clears both stores.
