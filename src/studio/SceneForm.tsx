import React, {useEffect, useRef, useState} from 'react';
import {TEMPLATE_LABELS} from '../shared/defaults';
import type {Scene} from '../shared/schema';

/**
 * An input that keeps its own text while you type, so half-typed values
 * ("3." or a trailing newline) are not rewritten under the cursor. It resyncs
 * only when the outside value changes to something the text does not mean.
 */
function Buffered<T>(props: {
  value: T;
  format: (value: T) => string;
  parse: (text: string) => T;
  onChange: (value: T) => void;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
  inputMode?: 'decimal';
}) {
  const {value, format, parse, onChange} = props;
  const external = format(value);
  const [text, setText] = useState(external);
  useEffect(() => {
    setText((current) => (format(parse(current)) === external ? current : external));
    // format/parse are stable per field; only the outside value matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external]);

  const shared = {
    value: text,
    placeholder: props.placeholder,
    className: props.mono ? 'mono' : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText(e.target.value);
      onChange(parse(e.target.value));
    },
  };
  return props.multiline ? (
    <textarea rows={props.rows ?? 3} {...shared} />
  ) : (
    <input type="text" inputMode={props.inputMode} {...shared} />
  );
}

const Field: React.FC<{label: string; hint?: string; wide?: boolean; children: React.ReactNode}> = ({
  label,
  hint,
  wide,
  children,
}) => (
  <label className={`field${wide ? ' wide' : ''}`}>
    <span className="field-label">
      {label}
      {hint ? <em>{hint}</em> : null}
    </span>
    {children}
  </label>
);

const identity = (s: string) => s;
const optional = (s: string) => (s.trim() === '' ? undefined : s);
const fromOptional = (s: string | undefined) => s ?? '';
const formatNumber = (n: number) => (Number.isFinite(n) ? String(n) : '');
const parseNumber = (s: string) => (s.trim() === '' ? NaN : Number(s));
const formatLines = (lines: string[]) => lines.join('\n');
const parseItems = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const parseRawLines = (s: string) => s.replace(/\n+$/, '').split('\n');
const formatData = (data: {label: string; value: number}[]) =>
  data.map((d) => `${d.label}, ${formatNumber(d.value)}`).join('\n');
const parseData = (s: string) =>
  s
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const cut = line.lastIndexOf(',');
      if (cut === -1) return {label: line.trim(), value: NaN};
      return {label: line.slice(0, cut).trim(), value: parseNumber(line.slice(cut + 1))};
    });

const PANS = ['zoom-in', 'zoom-out', 'left', 'right', 'up', 'down'] as const;

export const SceneForm: React.FC<{
  scene: Scene;
  images: string[];
  onChange: (scene: Scene) => void;
  onUpload: (file: File) => Promise<string | undefined>;
}> = ({scene, images, onChange, onUpload}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  // Every field edits one key of the current scene.
  const set = (patch: Record<string, unknown>) => onChange({...scene, ...patch} as Scene);

  const text = (key: string, label: string, opts: {optional?: boolean; hint?: string; multiline?: boolean} = {}) => (
    <Field label={label} hint={opts.hint ?? (opts.optional ? 'optional' : undefined)} wide>
      <Buffered<string | undefined>
        value={(scene as Record<string, unknown>)[key] as string | undefined}
        format={fromOptional}
        parse={opts.optional ? optional : identity}
        onChange={(v) => set({[key]: v})}
        multiline={opts.multiline}
        rows={2}
      />
    </Field>
  );

  const emphasisHint = 'wrap words in *asterisks* to emphasise';

  return (
    <div className="form-grid" key={scene.id}>
      <div className="form-heading wide">
        <span className={`badge badge-${scene.template}`}>{TEMPLATE_LABELS[scene.template]}</span>
        <Field label="Seconds">
          <Buffered
            value={scene.duration}
            format={formatNumber}
            parse={parseNumber}
            onChange={(duration) => set({duration})}
            inputMode="decimal"
          />
        </Field>
      </div>

      {scene.template === 'title' ? (
        <>
          {text('title', 'Title', {hint: emphasisHint})}
          {text('subtitle', 'Subtitle', {optional: true})}
        </>
      ) : null}

      {scene.template === 'kinetic' ? text('text', 'Text', {hint: emphasisHint, multiline: true}) : null}

      {scene.template === 'bullets' ? (
        <>
          {text('heading', 'Heading', {optional: true})}
          <Field label="Items" hint="one per line, up to 6" wide>
            <Buffered
              value={scene.items}
              format={formatLines}
              parse={parseItems}
              onChange={(items) => set({items})}
              multiline
              rows={5}
            />
          </Field>
        </>
      ) : null}

      {scene.template === 'stat' ? (
        <>
          <Field label="Prefix" hint="optional">
            <Buffered value={scene.prefix} format={fromOptional} parse={optional} onChange={(prefix) => set({prefix})} placeholder="$" />
          </Field>
          <Field label="Number">
            <Buffered value={scene.value} format={formatNumber} parse={parseNumber} onChange={(value) => set({value})} inputMode="decimal" />
          </Field>
          <Field label="Suffix" hint="optional">
            <Buffered value={scene.suffix} format={fromOptional} parse={optional} onChange={(suffix) => set({suffix})} placeholder="%" />
          </Field>
          {text('label', 'Label')}
        </>
      ) : null}

      {scene.template === 'chart' ? (
        <>
          {text('heading', 'Heading', {optional: true})}
          <Field label="Kind">
            <select value={scene.kind} onChange={(e) => set({kind: e.target.value})}>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
            </select>
          </Field>
          <Field label="Unit" hint="optional">
            <Buffered value={scene.unit} format={fromOptional} parse={optional} onChange={(unit) => set({unit})} placeholder="%" />
          </Field>
          <Field label="Data" hint="one “label, value” per line (2 to 8)" wide>
            <Buffered
              value={scene.data}
              format={formatData}
              parse={parseData}
              onChange={(data) => set({data})}
              multiline
              rows={6}
              mono
            />
          </Field>
        </>
      ) : null}

      {scene.template === 'image' ? (
        <>
          <Field label="Image" hint="a file in public/images, or a URL" wide>
            <div className="row">
              <Buffered value={scene.src} format={identity} parse={identity} onChange={(src) => set({src})} />
              <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                Upload…
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const src = await onUpload(file);
                  if (src) set({src});
                }}
              />
            </div>
          </Field>
          {images.length ? (
            <div className="thumbs wide">
              {images.map((src) => (
                <button
                  type="button"
                  key={src}
                  className={`thumb${src === scene.src ? ' active' : ''}`}
                  title={src}
                  onClick={() => set({src})}
                >
                  <img src={`/${src}`} alt={src} />
                </button>
              ))}
            </div>
          ) : null}
          <Field label="Camera move">
            <select value={scene.pan ?? 'zoom-in'} onChange={(e) => set({pan: e.target.value})}>
              {PANS.map((p) => (
                <option key={p} value={p}>
                  {p === 'zoom-in' || p === 'zoom-out' ? p.replace('-', ' ') : `pan ${p}`}
                </option>
              ))}
            </select>
          </Field>
          {text('caption', 'Caption', {optional: true})}
        </>
      ) : null}

      {scene.template === 'terminal' ? (
        <>
          {text('title', 'Window title', {optional: true})}
          <Field label="Lines" hint="start a line with “$ ” to type it as a command" wide>
            <Buffered
              value={scene.lines}
              format={formatLines}
              parse={parseRawLines}
              onChange={(lines) => set({lines})}
              multiline
              rows={6}
              mono
            />
          </Field>
        </>
      ) : null}

      {scene.template === 'outro' ? (
        <>
          {text('title', 'Title', {hint: emphasisHint})}
          {text('subtitle', 'Subtitle', {optional: true})}
          {text('cta', 'Call to action', {optional: true})}
        </>
      ) : null}

      <Field label="Narration" hint="spoken by the voiceover and shown as captions" wide>
        <Buffered
          value={scene.narration}
          format={fromOptional}
          parse={optional}
          onChange={(narration) => set({narration})}
          multiline
          rows={2}
        />
      </Field>
    </div>
  );
};
