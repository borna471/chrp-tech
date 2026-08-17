# Editable content

## `photo-tasks.json`

The photo list the homeowner works through. This file is the only place the list
lives — edit it, save, and the app picks the change up on the next reload. No
code change is needed to add, remove, reorder or reword an item.

The list is a JSON array. Items appear in the app in the order they appear here.

```json
{
  "slug": "water-heater",
  "name": "Water heater",
  "zone": "Utility",
  "risk": "Water & fire",
  "instruction": "Stand about six feet back and photograph the full unit…",
  "tips": [
    "The top of the unit: supply connections, fittings, and the T&P valve…",
    "The base of the tank and the floor: drip pan, rust at the bottom seam…"
  ],
  "requiredElements": [
    { "id": "full-tank", "description": "The whole height of the tank, top to bottom" },
    { "id": "tank-base", "description": "The base of the tank and the floor beneath it" }
  ],
  "checks": [
    {
      "id": "base-corrosion",
      "lookFor": "Rust, flaking or corrosion at the bottom seam of the tank…",
      "severity": "urgent"
    },
    {
      "id": "unit-age",
      "lookFor": "Signs the unit is old — a dated or corroded data plate…",
      "severity": "advisory",
      "closeUpPrompt": "The unit looks past ten years old. Add a close-up…"
    }
  ]
}
```

| Field | Required | What it does |
| --- | --- | --- |
| `slug` | yes | Stable id, lowercase with dashes. Must be unique. Changing it detaches any photos already captured against the old one, so prefer editing the other fields. |
| `name` | yes | The title, shown as the heading on the capture screen and in the photo list. |
| `zone` | yes | Where in the home this is. Shown above the title and under the name in the list. Reuse an existing value (`Exterior`, `Utility`, `Kitchen`, `Bathroom`, `Interior`) so items group sensibly. |
| `risk` | yes | What the insurer is looking for here: `Water`, `Fire` or `Water & fire`. Shown beside the zone. |
| `instruction` | yes | One sentence telling the homeowner what to shoot. This is the paragraph under the title — say where to stand and what to frame. |
| `tips` | yes | The bullets under "Make sure we can see". Each is one specific thing that must be visible. Any number is fine; three to five reads best. |
| `requiredElements` | yes | What the reviewer must be able to see for the photo to count. If one is missing, the homeowner is asked to retake. See below. |
| `checks` | yes | The conditions the reviewer looks for in the photo. These are what the insurer acts on. See below. |

## `requiredElements` — what makes a photo usable

```json
{ "id": "p-trap", "description": "Both sides of the P-trap, in one frame" }
```

| Field | Required | What it does |
| --- | --- | --- |
| `id` | yes | Stable key, unique within the item. Used to match the reviewer's answer back to the element. |
| `description` | yes | What must be visible. **Written for the reviewer, not the homeowner** — describe one thing that can be confirmed in a single frame. |

**This is not the same as `tips`.** `tips` is guidance the homeowner reads *before*
shooting, and some tips describe several photos ("One photo per level of the
home") which can't be checked in one frame. Keep two or three required elements
per item — every one you add is another way a good photo can be rejected.

## `checks` — what the reviewer looks for

```json
{
  "id": "cabinet-water-damage",
  "lookFor": "Dark staining, swelling or delaminated particleboard on the cabinet floor",
  "severity": "urgent",
  "closeUpPrompt": "We see a dark ring on the cabinet floor near the trap. Take one close-up…"
}
```

| Field | Required | What it does |
| --- | --- | --- |
| `id` | yes | Stable key, unique within the item. Findings are stored under it, so the same id across many homes is how the insurer counts "how many properties have this". Don't rename one casually — it breaks that history. |
| `lookFor` | yes | One condition, phrased as something visible in a photo. Keep it observational ("dark staining on the cabinet floor"), not diagnostic ("water damage") — the reviewer reports what it sees, and the judgement happens afterwards. |
| `severity` | yes | How the insurer triages it if found: `advisory`, `attention` or `urgent`. Insurer-facing only; the homeowner never sees it. |
| `closeUpPrompt` | no | If present, an uncertain finding on this check asks the homeowner for a close-up, showing this text. Written as an instruction, since they act on it. Omit unless a second photo would actually settle the question. |

One condition per check. If a check needs an "and" or an "or", it is usually two
checks — separate ids means the insurer can act on each one on its own.

### Notes

- Validation runs when the app loads the file. A missing field, an empty list, or
  a duplicate `slug`, element `id` or check `id` fails immediately with a message
  naming the item — so a typo shows up as an error, not as a blank screen.
- `lookFor` and `requiredElements[].description` are sent to the vision model
  verbatim. They are prompt text: clear, concrete wording measurably changes what
  comes back. Rewording them is the main way to tune the reviewer without code.
- Findings are **not shown to the homeowner** in the shipping product — the
  capture screen only says whether a photo is usable or a close-up is wanted.
  (There is a testing panel behind `demoConfig.showAnalysisDebug` that does show
  them; it must be off before real homeowners use the app.)
- Which items the demo opens as already captured is set by `DEMO_COMPLETED_SLUGS`
  in `lib/tasks.ts` — that is demo staging, not content, so it stays in code.

## `data-use-policy.json`

The policy shown in the scrollable box on the consent step of onboarding. A JSON
array of sections, rendered in order:

```json
{
  "heading": "1. What we collect",
  "paragraphs": ["…", "…"]
}
```

Both fields are required. Unlike the photo list there is no validation pass and
no entity behind it — this is presentational copy the consent page reads
directly.

**The text in there now is placeholder, not legal language.** It exists so the
box has something real-shaped to scroll. Replace it with the actual policy
before this goes in front of a homeowner.
