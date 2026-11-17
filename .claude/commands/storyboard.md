---
description: Turn a video concept into a validated storyboard JSON for Video Studio
argument-hint: <concept> [theme: notebook|midnight|sunrise] [length in seconds]
allowed-tools: Read, Write, Edit, Glob, Bash(npm run validate:*), Bash(npm run render:*)
---

Write a Video Studio storyboard for this concept:

$ARGUMENTS

## Steps

1. Read `src/shared/guide.ts` (the format, written for a model) and `src/shared/schema.ts`
   (the source of truth for every field and limit). Read `storyboards/sample.json` for a
   complete working example. Do not rely on memory of the format.
2. Check which images exist with a glob on `public/images/*`. Only use the `image` template
   with a file that is really there and fits the concept; otherwise skip that template.
3. Write the storyboard to `storyboards/<short-kebab-case-name>.json`. If that file already
   exists and is not something you just wrote in this session, pick a different name
   instead of overwriting it.
4. Run `npm run validate -- storyboards/<name>.json`. If it reports problems, fix the file
   and run it again until it passes. Never report success on a storyboard that has not
   passed validation.
5. Reply with: the file path, a one-line summary per scene, the total length the validator
   printed, and the command to render it:
   `npm run render -- storyboards/<name>.json --aspect both`
   Do not render unless asked to.

## Writing guidance

- Default to about 30 seconds and the `notebook` theme unless the concept says otherwise.
- Open with a `title` scene and close with an `outro`. Vary the templates in between and
  avoid using the same one twice in a row.
- On-screen text is short and punchy. Give every scene a `narration` line (one spoken
  sentence, under about 20 words) that carries the detail: it becomes the voiceover and
  the captions.
- Wrap one or two key words per title or kinetic line in `*asterisks*` for emphasis. Never
  put asterisks in `narration`.
- `stat` and `chart` values are plain numbers. Only use real figures the concept gives
  you; if you need an illustrative number, make it obviously playful rather than a
  made-up fact.
- A scene's `duration` should give its narration time to be read aloud: roughly 2.5 words
  per second, minimum 2.5 seconds.
- Set `"captions": true` and `"voiceover": {"enabled": true, "voice": "Samantha", "rate": 185}`
  only if the concept asks for sound or captions. Leave `audio` fields out; the voiceover
  step writes those.
