#!/usr/bin/env node
// Generic Icon Generator for NexusVTT using a local ComfyUI (Flux schnell GGUF).
// Supports panel icons, status conditions, spells, actions, items, or arbitrary ad-hoc icons.
//
// Usage examples (from apps/vtt):
//   # 1. Default: generate missing GameUI panel icons
//   node scripts/generate-panel-icons.mjs
//   node scripts/generate-panel-icons.mjs --force
//   node scripts/generate-panel-icons.mjs --only dice,chat
//
//   # 2. Ad-hoc single icon generation
//   node scripts/generate-panel-icons.mjs --name fireball --subject "a blazing fireball explosion with embers"
//   node scripts/generate-panel-icons.mjs --name stealth --subject "a shadowed cloaked rogue face" --preset actions
//   node scripts/generate-panel-icons.mjs --subject "a glowing holy broadsword" --out-dir ./public/assets/icons/weapons
//
//   # 3. Batch generation from a JSON file
//   node scripts/generate-panel-icons.mjs --input my-icons.json --out-dir ./public/assets/icons/custom
//
//   # 4. Use built-in presets (panels, conditions, spells, actions, items, generic)
//   node scripts/generate-panel-icons.mjs --preset conditions
//
//   # 5. Variants, resizing, and custom palettes
//   node scripts/generate-panel-icons.mjs --name dragon-breath --subject "a roaring dragon breath cone" --variants 4
//   node scripts/generate-panel-icons.mjs --name potion --subject "a glass potion bottle" --palette "emerald green and silver"
//   node scripts/generate-panel-icons.mjs --reprocess --bg-threshold 230  # re-cut transparency on existing PNGs
//
// Backgrounds are made transparent by flood-filling near-white pixels inward from the
// image edges (so white details *inside* an icon are kept), then feathering the edge.
//
// Env: COMFY_URL (default http://localhost:8188)

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COMFY_URL = process.env.COMFY_URL ?? 'http://localhost:8188';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ASSETS_DIR = path.resolve(SCRIPT_DIR, '../public/assets/icons');

// Built-in Presets
const PRESETS = {
  panels: {
    outDir: path.join(ROOT_ASSETS_DIR, 'panels'),
    style:
      'flat vector game UI icon, fantasy tabletop RPG style, bold clean outlines, ' +
      'simple geometric shapes, single centered symbol, limited palette of deep indigo ' +
      'and warm gold, solid plain white background, no text, no letters, crisp edges, minimalist',
    items: [
      { file: 'atlas', subject: 'an open atlas book with a compass rose on its cover' },
      { file: 'tokens', subject: 'a round game token with a hooded adventurer silhouette' },
      { file: 'scene', subject: 'a framed landscape picture with mountains and a sun' },
      { file: 'props', subject: 'a wooden treasure crate with a lid' },
      { file: 'session-plan', subject: 'a clipboard with a checklist' },
      { file: 'generator', subject: 'a folded treasure map with a dotted path and an X mark' },
      { file: 'initiative', subject: 'an hourglass' },
      { file: 'characters', subject: 'two adventurer silhouettes standing side by side' },
      { file: 'dice', subject: 'a single twenty-sided die (d20) with a 20 showing' },
      { file: 'documents', subject: 'a stack of parchment scrolls' },
      { file: 'chat', subject: 'a speech bubble' },
      { file: 'sounds', subject: 'a speaker with sound waves' },
      { file: 'lobby', subject: 'a castle gatehouse with a door' },
      { file: 'settings', subject: 'a gear cog' },
    ],
  },
  conditions: {
    outDir: path.join(ROOT_ASSETS_DIR, 'conditions'),
    style:
      'tabletop RPG status condition icon, emblem badge style, bold graphic symbol, ' +
      'high contrast, clean vector silhouettes, warning iconography, solid plain white background, ' +
      'no text, no letters, minimalist',
    items: [
      { file: 'blinded', subject: 'an open eye with a diagonal slash through it' },
      { file: 'charmed', subject: 'a glowing heart radiating spiral charm waves' },
      { file: 'deafened', subject: 'an ear icon with a cross through it' },
      { file: 'frightened', subject: 'a screaming mask or terrified skull face' },
      { file: 'grappled', subject: 'two gripping skeletal hands clasping tightly' },
      { file: 'incapacitated', subject: 'a cracked shattered shield with a drooping head' },
      { file: 'invisible', subject: 'a dotted outline of a hooded figure disappearing into thin air' },
      { file: 'paralyzed', subject: 'a lightning bolt striking a stiff frozen human figure' },
      { file: 'petrified', subject: 'a cracked stone statue head with rocky texture' },
      { file: 'poisoned', subject: 'a bubbling toxic potion vial with a skull drop' },
      { file: 'prone', subject: 'a silhouette of a person lying flat on the ground' },
      { file: 'restrained', subject: 'heavy iron chains and shackles binding limbs' },
      { file: 'stunned', subject: 'a head with a ring of spinning dazed stars around it' },
      { file: 'unconscious', subject: 'a closed drooping eye with three Z floating sleep symbols' },
      { file: 'exhaustion', subject: 'a wilting candle flame nearly extinguished' },
      { file: 'dead', subject: 'a grim skull with crossbones' },
    ],
  },
  spells: {
    outDir: path.join(ROOT_ASSETS_DIR, 'spells'),
    style:
      'fantasy magic spell icon, glowing arcane sigil, magical energy burst, ' +
      'clean vector silhouette, elemental power, tabletop RPG UI, solid plain white background, ' +
      'no text, no letters, crisp outlines',
    items: [],
  },
  actions: {
    outDir: path.join(ROOT_ASSETS_DIR, 'actions'),
    style:
      'tabletop combat action icon, dynamic graphic symbol, clean martial fantasy vector, ' +
      'bold outlines, solid plain white background, no text, no letters, minimalist',
    items: [],
  },
  items: {
    outDir: path.join(ROOT_ASSETS_DIR, 'items'),
    style:
      'tabletop fantasy RPG inventory item icon, clean vector equipment, distinct silhouette, ' +
      'solid plain white background, no text, no letters, crisp outlines, high readability',
    items: [],
  },
  generic: {
    outDir: ROOT_ASSETS_DIR,
    style:
      'flat vector game UI icon, fantasy tabletop RPG style, bold clean outlines, ' +
      'simple geometric shapes, single centered symbol, solid plain white background, ' +
      'no text, no letters, crisp edges, minimalist',
    items: [],
  },
};

/**
 * Turns the solid white background of a generated icon into transparency.
 * Flood-fills near-white pixels connected to the image border, then softens the
 * boundary and removes the white fringe baked into anti-aliased edge pixels.
 */
async function removeBackground(png, threshold) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = new Uint8ClampedArray(data);
  const minChannel = (i) => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  const isBgCandidate = (i) => px[i * 4 + 3] < 10 || minChannel(i) >= threshold;

  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => {
    const i = y * w + x;
    if (!bg[i] && isBgCandidate(i)) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }

  const EDGE_LOW = 120; // pixels at/below this min-channel are treated as fully opaque
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (bg[i]) {
      px[o + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i - x) / w;
    const touchesBg =
      (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (!touchesBg) continue;
    // Edge pixel: estimate how much of it is icon vs. white, then un-blend the white.
    const alpha = Math.min(1, Math.max(0.15, (255 - minChannel(i)) / (255 - EDGE_LOW)));
    for (let c = 0; c < 3; c++) {
      px[o + c] = Math.min(255, Math.max(0, (px[o + c] - 255 * (1 - alpha)) / alpha));
    }
    px[o + 3] = Math.round(alpha * 255);
  }

  // Trim transparent padding tightly into content bounding box and pad with 4% safe margin
  const trimmed = await sharp(Buffer.from(px.buffer), { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 10 })
    .toBuffer({ resolveWithObject: true });

  const margin = Math.round(w * 0.04);
  return sharp(trimmed.data, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } })
    .resize(w - margin * 2, h - margin * 2, { fit: 'inside' })
    .extend({
      top: margin,
      bottom: margin,
      left: margin,
      right: margin,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function printHelp() {
  console.log(`
NexusVTT Icon Generator (via ComfyUI / Flux schnell)
===================================================

Usage:
  node scripts/generate-panel-icons.mjs [options]

Modes:
  1. Default (Panel Icons):
     node scripts/generate-panel-icons.mjs [--only dice,chat] [--force]

  2. Ad-Hoc Icon Generation:
     node scripts/generate-panel-icons.mjs --name <filename> --subject "<description>"
     node scripts/generate-panel-icons.mjs --subject "a blazing fireball" [--name fireball]

  3. Batch from JSON File or Stdin:
     node scripts/generate-panel-icons.mjs --input ./my-icons.json [--out-dir ./public/assets/icons/spells]
     cat list.json | node scripts/generate-panel-icons.mjs --stdin

  4. Presets:
     --preset panels      (default, UI panel buttons: deep indigo & warm gold)
     --preset conditions  (D&D 5e status condition badges)
     --preset spells      (arcane elemental spell icons)
     --preset actions     (combat & martial action symbols)
     --preset items       (tabletop inventory equipment)
     --preset generic     (clean tabletop RPG vector icon)

Options:
  --name, -n <str>         Output file basename (without .png)
  --subject, -s <str>      What the icon depicts (e.g. "a flaming sword")
  --prompt, -p <str>       Full raw prompt override (bypasses automatic style wrapping)
  --input, -i <path>       Path to JSON file containing array of { file, subject } or { name, description }
  --stdin                  Read JSON list from stdin
  --preset <preset>        One of: panels, conditions, spells, actions, items, generic
  --out-dir, -o <path>     Directory to save PNGs (defaults to preset's folder)
  --style <str>            Override the preset style prompt template
  --palette <str>          Specify color palette (e.g. "crimson and gold", "spectral blue")
  --only <csv>             Filter by icon names (e.g. --only dice,chat)
  --variants <num>         Generate N variations per icon (<name>-1.png, <name>-2.png...) [default: 1]
  --size <num>             Resolution in pixels (width/height) [default: 256]
  --seed <num>             RNG seed [default: 1234]
  --force                  Overwrite existing files [default: skip existing]
  --keep-background        Do not remove white background (keep opaque)
  --reprocess              Offline mode: re-run transparency flood-fill on existing PNGs
  --bg-threshold <num>     Flood-fill brightness threshold (0-255) [default: 238]
  --help, -h               Show this help message

Environment:
  COMFY_URL                ComfyUI endpoint [default: http://localhost:8188]
`);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function parseArgs(argv) {
  const args = {
    help: false,
    force: false,
    only: null,
    variants: 1,
    size: 256,
    seed: 1234,
    transparent: true,
    reprocess: false,
    bgThreshold: 238,
    preset: null,
    name: null,
    subject: null,
    prompt: null,
    input: null,
    stdin: false,
    outDir: null,
    style: null,
    palette: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--name' || a === '-n') args.name = argv[++i];
    else if (a === '--subject' || a === '-s') args.subject = argv[++i];
    else if (a === '--prompt' || a === '-p') args.prompt = argv[++i];
    else if (a === '--input' || a === '-i') args.input = argv[++i];
    else if (a === '--stdin') args.stdin = true;
    else if (a === '--preset') args.preset = argv[++i].toLowerCase();
    else if (a === '--out-dir' || a === '-o') args.outDir = path.resolve(process.cwd(), argv[++i]);
    else if (a === '--style') args.style = argv[++i];
    else if (a === '--palette') args.palette = argv[++i];
    else if (a === '--keep-background') args.transparent = false;
    else if (a === '--reprocess') args.reprocess = true;
    else if (a === '--bg-threshold') args.bgThreshold = Number(argv[++i]);
    else if (a === '--force') args.force = true;
    else if (a === '--only') args.only = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--variants') args.variants = Number(argv[++i]);
    else if (a === '--size') args.size = Number(argv[++i]);
    else if (a === '--seed') args.seed = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${a}. Use --help to view available options.`);
  }

  if (!args.preset) {
    args.preset = (args.name || args.subject || args.input || args.stdin || args.prompt)
      ? 'generic'
      : 'panels';
  }

  return args;
}

function buildWorkflow(prompt, seed, size) {
  return {
    3: {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: 4,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
        model: ['12', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    5: { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['13', 0] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['13', 0] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['14', 0] } },
    15: {
      class_type: 'ImageScale',
      inputs: {
        image: ['8', 0],
        upscale_method: 'lanczos',
        width: size,
        height: size,
        crop: 'disabled',
      },
    },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: 'panel-icons/icon', images: ['15', 0] } },
    12: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'flux1-schnell-Q4_K_S.gguf' } },
    13: {
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: 't5xxl_fp8_e4m3fn_scaled.safetensors',
        clip_name2: 'clip_l.safetensors',
        type: 'flux',
      },
    },
    14: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
  };
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function comfy(pathname, init) {
  const res = await fetch(`${COMFY_URL}${pathname}`, init);
  if (!res.ok) throw new Error(`${pathname} -> ${res.status} ${await res.text()}`);
  return res;
}

async function generate(prompt, seed, size) {
  const queued = await (
    await comfy('/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildWorkflow(prompt, seed, size) }),
    })
  ).json();
  const id = queued.prompt_id;

  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const history = await (await comfy(`/history/${id}`)).json();
    const entry = history[id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') {
      const err = entry.status.messages.find((m) => m[0] === 'execution_error');
      throw new Error(err?.[1]?.exception_message ?? 'ComfyUI execution error');
    }
    const img = entry.outputs?.[9]?.images?.[0];
    if (img) {
      const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
      return Buffer.from(await (await comfy(`/view?${q}`)).arrayBuffer());
    }
  }
  throw new Error('Timed out waiting for ComfyUI response');
}

/**
 * Normalizes input definitions into a standard [{ file: string, subject: string, prompt?: string }] array.
 */
async function resolveIconTargets(args) {
  // Mode 1: Single ad-hoc icon from command line
  if (args.subject || args.prompt || args.name) {
    const file = args.name || (args.subject ? slugify(args.subject) : 'custom-icon');
    const subject = args.subject || '';
    return [{ file, subject, prompt: args.prompt }];
  }

  // Mode 2: Stdin JSON
  if (args.stdin) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf-8');
    return normalizeJsonIcons(JSON.parse(raw));
  }

  // Mode 3: JSON File input
  if (args.input) {
    const raw = await readFile(path.resolve(process.cwd(), args.input), 'utf-8');
    return normalizeJsonIcons(JSON.parse(raw));
  }

  // Mode 4: Preset items (e.g. panels, conditions)
  const presetConfig = PRESETS[args.preset] || PRESETS.panels;
  return [...presetConfig.items];
}

function normalizeJsonIcons(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.map((item, idx) => ({
      file: item.file || item.name || item.id || `icon-${idx + 1}`,
      subject: item.subject || item.description || item.desc || '',
      prompt: item.prompt,
    }));
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return Object.entries(parsed).map(([key, val]) => ({
      file: key,
      subject: typeof val === 'string' ? val : val.subject || val.description || '',
      prompt: typeof val === 'object' ? val.prompt : undefined,
    }));
  }
  throw new Error('Invalid JSON format: expected array of icons or key-value map.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const presetConfig = PRESETS[args.preset] || PRESETS.generic;
  const outDir = args.outDir || presetConfig.outDir || ROOT_ASSETS_DIR;

  // Resolve base style
  let baseStyle = args.style || presetConfig.style || PRESETS.generic.style;
  if (args.palette) {
    baseStyle += `, limited palette of ${args.palette}`;
  }

  // Collect target icons
  let targets = await resolveIconTargets(args);

  if (targets.length === 0) {
    console.log(`No icons specified for preset "${args.preset}". Use --subject or --input to provide icon descriptions.`);
    return;
  }

  if (args.only) {
    targets = targets.filter((t) => args.only.includes(t.file));
    if (targets.length === 0) {
      console.log(`No matching icons found for filter: ${args.only.join(', ')}`);
      return;
    }
  }

  await mkdir(outDir, { recursive: true });

  // Reprocess existing PNGs without calling ComfyUI
  if (args.reprocess) {
    let reprocessed = 0;
    for (const icon of targets) {
      const candidates = [
        `${icon.file}.png`,
        ...Array.from({ length: 9 }, (_, i) => `${icon.file}-${i + 1}.png`),
      ];
      for (const name of candidates) {
        const outPath = path.join(outDir, name);
        if (!(await exists(outPath))) continue;
        const rawPng = await readFile(outPath);
        const cleaned = await removeBackground(rawPng, args.bgThreshold);
        await writeFile(outPath, cleaned);
        console.log(`cleaned  ${name}`);
        reprocessed++;
      }
    }
    console.log(`\nDone: ${reprocessed} icon(s) reprocessed in ${outDir}`);
    return;
  }

  // Verify ComfyUI server is reachable
  try {
    await comfy('/system_stats');
  } catch (err) {
    throw new Error(
      `Cannot connect to ComfyUI at ${COMFY_URL}. Ensure ComfyUI is running or pass COMFY_URL=<url>.\nDetails: ${err.message}`
    );
  }

  console.log(`\n🎨 NexusVTT Icon Generator`);
  console.log(`   Preset:    ${args.preset}`);
  console.log(`   Output:    ${outDir}`);
  console.log(`   Icons:     ${targets.length} target(s)`);
  console.log(`   Size:      ${args.size}x${args.size}px`);
  console.log(`   Variants:  ${args.variants} per icon`);
  console.log(`   Backend:   ${COMFY_URL}\n`);

  let done = 0;
  for (const icon of targets) {
    for (let v = 1; v <= args.variants; v++) {
      const name = args.variants > 1 ? `${icon.file}-${v}.png` : `${icon.file}.png`;
      const outPath = path.join(outDir, name);

      if (!args.force && (await exists(outPath))) {
        console.log(`skip     ${name} (already exists, use --force to overwrite)`);
        continue;
      }

      // Assemble final prompt
      const fullPrompt = icon.prompt
        ? icon.prompt
        : `${baseStyle}. The icon depicts ${icon.subject}.`;

      const started = Date.now();
      let png = await generate(fullPrompt, args.seed + v - 1, args.size);

      if (args.transparent) {
        png = await removeBackground(png, args.bgThreshold);
      }

      await writeFile(outPath, png);
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`created  ${name} (${elapsed}s)`);
      done++;
    }
  }

  console.log(`\n✨ Successfully generated ${done} icon(s) in ${outDir}`);
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
