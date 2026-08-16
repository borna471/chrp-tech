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
  "followUpPrompt": "The unit looks past ten years old. Add a close-up…"
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
| `followUpPrompt` | no | If present, the reviewer asks for a close-up the first time this photo is taken, showing this text. Written as an instruction, since the homeowner acts on it. Omit for items that should be accepted first time. |

### Notes

- Validation runs when the app loads the file. A missing field, an empty `tips`
  list or a duplicate `slug` fails immediately with a message naming the item —
  so a typo shows up as an error, not as a blank screen.
- `followUpPrompt` currently drives the mock reviewer in `lib/ai/analyzePhoto.ts`.
  When the real vision model is wired in it becomes the fallback prompt for that
  item rather than a scripted response.
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
