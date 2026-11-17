# Video Studio

A local storyboard-to-video studio built on [Remotion](https://www.remotion.dev). One JSON file in, one MP4 out. Zero paid APIs: rendering, the LLM (Ollama) and the voiceover (macOS `say`) all run on your machine.

Remotion is free for individuals and companies of up to 3 people; see the [Remotion license](https://www.remotion.dev/docs/license).

## Run it

```bash
npm install
npm run studio        # Studio UI at http://localhost:5177
```

In the Studio you can edit the storyboard in a form, watch a live preview, reorder scenes, switch themes, generate voiceover, and export 16:9 or 9:16 MP4s into `out/`.

Command line:

```bash
npm run validate  -- storyboards/sample.json
npm run render    -- storyboards/sample.json --aspect both   # 16:9, 9:16 or both
npm run voiceover -- storyboards/trailer.json                # speak narration with `say`
npm run generate  -- "your concept" --seconds 30             # Ollama writes the storyboard
npm test
```

Idea to video, two routes:

- **Ollama**: the "Idea → video" box in the Studio, or `npm run generate`. Needs `ollama serve` and a model (`gemma3` by default; override with `--model` or `OLLAMA_MODEL`). Output is validated and retried with the errors fed back.
- **Claude Code**: `/storyboard <concept>` writes and validates a storyboard file.

## Storyboard format

The source of truth is `src/shared/schema.ts`; `storyboards/sample.json` uses every template.

- Top level: `title`, `theme` (`notebook`, `midnight`, `sunrise`), `transition` (`fade`, `slide`, `wipe`, `none`), `voiceover`, `captions`, `scenes`.
- Every scene: `template`, `duration` (seconds), optional `narration` (spoken and captioned).
- Templates: `title`, `kinetic`, `bullets`, `stat`, `chart`, `image`, `terminal`, `outro`.
- Wrap words in `*asterisks*` in titles and kinetic text to emphasise them.
- Images live in `public/images/`. With voiceover on, scenes stretch to fit the audio.

## Add a scene template

1. **Schema**: in `src/shared/schema.ts`, add the id to `TEMPLATE_IDS`, add its zod object to `sceneSchemas`, and add it to the `sceneSchema` union.
2. **Component**: create `src/remotion/scenes/MyScene.tsx` taking `{scene: SceneOf<'my-id'>}`. Wrap it in `<SceneFrame>`, size everything with `u` from `useLayout()` so it works in both aspect ratios, and take colours and fonts from `useTheme()`.
3. **Register**: add it to `sceneComponents` in `src/remotion/scenes/index.ts`.
4. **Studio**: add a label, default and summary in `src/shared/defaults.ts`, and its fields in `src/studio/SceneForm.tsx`.
5. **LLM**: describe it in `src/shared/guide.ts` so Ollama and `/storyboard` can use it.

TypeScript will point at any of these you miss.

## Layout

- `src/shared/` schema, timeline maths, LLM guide (used by browser and server)
- `src/remotion/` composition, themes, scene templates
- `src/studio/` the Studio UI
- `server/` Express API: render, Ollama, voiceover, files
- `scripts/` command-line tools
