#!/usr/bin/env node
// design-system.mjs — render the base design-system CSS from tokens.json.
//
// Source of truth: harness/design-system/tokens.json.
// The generated output is harness/design-system/tokens.css.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths, resolveProjectRootFromScript } from './paths.mjs';
import { maybeHelp } from './lib/cli-io.mjs';
if (maybeHelp(import.meta.url)) process.exit(0);

const ROOT = resolveProjectRootFromScript(import.meta.url);

function camelToKebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\./g, '')
    .replace(/_/g, '-')
    .toLowerCase();
}

function unwrap(value) {
  const match = typeof value === 'string' && value.match(/^\{(.+)\}$/);
  if (!match) return value;
  return `var(--ds-${match[1].replace(/\./g, '-')})`;
}

function rawTokenLines(tokens) {
  const lines = [];
  const addGroup = (comment, obj, prefix) => {
    lines.push(`  /* ${comment} */`);
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('$')) continue;
      lines.push(`  ${prefix(key)}: ${unwrap(val.$value)};`);
    }
    lines.push('');
  };

  addGroup('Brand hue ramp', tokens.color.brand, (k) => `--ds-color-brand-${k}`);
  addGroup('Neutral ramp', tokens.color.neutral, (k) => `--ds-color-neutral-${k}`);
  addGroup('Spacing — 8 px grid (every step is 4 px or 8 px aligned)', tokens.spacing, (k) => `--ds-space-${k.replace(/\./g, '')}`);
  addGroup('Border radius', tokens.borderRadius, (k) => `--ds-radius-${camelToKebab(k)}`);
  addGroup('Layout — control sizes (shared height scale: button/input/select align when they share a size)', tokens.size, (k) => `--ds-size-${camelToKebab(k)}`);
  addGroup('Layout — container & content (measure) widths; cap reading/form width, never full-bleed', tokens.width, (k) => `--ds-width-${camelToKebab(k)}`);
  addGroup('Layout — named breakpoints (mirror in @media / @container thresholds; never raw px)', tokens.breakpoint, (k) => `--ds-bp-${k}`);
  addGroup('Typography — font families', tokens.typography.fontFamily, (k) => `--ds-font-${k}`);
  addGroup('Typography — 1.25 modular scale (base 16 px)', tokens.typography.fontSize, (k) => `--ds-text-${k}`);
  addGroup('Typography — weights', tokens.typography.fontWeight, (k) => `--ds-font-weight-${camelToKebab(k)}`);
  addGroup('Typography — line heights', tokens.typography.lineHeight, (k) => `--ds-leading-${k}`);
  addGroup('Typography — letter spacing', tokens.typography.letterSpacing, (k) => `--ds-tracking-${k}`);
  addGroup('Shadows — elevation ramp', tokens.shadow, (k) => `--ds-shadow-${camelToKebab(k)}`);
  addGroup('Transitions', tokens.transition, (k) => `--ds-transition-${k}`);
  addGroup('Z-index layers', tokens.zIndex, (k) => `--ds-z-${k}`);
  return lines;
}

function semanticGroupLines(prefix, group) {
  const lines = [];
  for (const [key, val] of Object.entries(group)) {
    if (key.startsWith('$')) continue;
    lines.push(`  --ds-${prefix}-${camelToKebab(key)}: ${unwrap(val.$value)};`);
  }
  lines.push('');
  return lines;
}

const DARK_MODE = {
  bg: {
    base: { $value: '{color.neutral.950}' },
    subtle: { $value: '{color.neutral.900}' },
    muted: { $value: '{color.neutral.800}' },
    overlay: { $value: '{color.neutral.950}' },
  },
  surface: {
    default: { $value: '{color.neutral.900}' },
    raised: { $value: '{color.neutral.800}' },
    sunken: { $value: '{color.neutral.950}' },
  },
  border: {
    default: { $value: '{color.neutral.700}' },
    strong: { $value: '{color.neutral.600}' },
    focus: { $value: '{color.brand.400}' },
  },
  text: {
    primary: { $value: '{color.neutral.50}' },
    secondary: { $value: '{color.neutral.400}' },
    disabled: { $value: '{color.neutral.600}' },
    inverse: { $value: '{color.neutral.900}' },
    link: { $value: '{color.brand.300}' },
    linkHover: { $value: '{color.brand.200}' },
  },
  action: {
    bg: { $value: '{color.brand.500}' },
    bgHover: { $value: '{color.brand.400}' },
    bgActive: { $value: '{color.brand.300}' },
    bgDisabled: { $value: '{color.neutral.700}' },
    text: { $value: '{color.neutral.0}' },
    textDisabled: { $value: '{color.neutral.500}' },
  },
  success: {
    bg: { $value: '#052e16' },
    border: { $value: '#166534' },
    text: { $value: '#bbf7d0' },
    icon: { $value: '#4ade80' },
  },
  warning: {
    bg: { $value: '#1c1400' },
    border: { $value: '#92400e' },
    text: { $value: '#fde68a' },
    icon: { $value: '#fbbf24' },
  },
  danger: {
    bg: { $value: '#1c0505' },
    border: { $value: '#991b1b' },
    text: { $value: '#fecaca' },
    icon: { $value: '#f87171' },
  },
  info: {
    bg: { $value: '{color.brand.950}' },
    border: { $value: '{color.brand.800}' },
    text: { $value: '{color.brand.100}' },
    icon: { $value: '{color.brand.300}' },
  },
  shadow: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.30)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.40), 0 1px 2px -1px rgb(0 0 0 / 0.40)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.40), 0 2px 4px -2px rgb(0 0 0 / 0.40)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.40), 0 4px 6px -4px rgb(0 0 0 / 0.40)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.50), 0 8px 10px -6px rgb(0 0 0 / 0.40)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.60)',
    focus: '0 0 0 3px rgb(129 140 248 / 0.50)',
  },
};

function readTokens(root) {
  const path = join(root, resolvePaths(root).engine, 'design-system', 'tokens.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function computeDesignSystemCss(root = ROOT) {
  const tokens = readTokens(root);
  if (!tokens) return '';

  const raw = rawTokenLines(tokens);
  const semantic = tokens.color.semantic;
  const lines = [
    '/* Midas design-system — CSS custom properties */',
    '/* Mirrors tokens.json (W3C Design Tokens format). */',
    '/* Generated from tokens.json — keep in sync with the JSON source. */',
    '',
    ':root {',
    ...raw,
    '}',
    '',
    ':root {',
    '  /* Backgrounds */',
    ...semanticGroupLines('bg', semantic.bg),
    '  /* Surfaces */',
    ...semanticGroupLines('surface', semantic.surface),
    '  /* Borders */',
    ...semanticGroupLines('border', semantic.border),
    '  /* Text — AA-contrast verified on bg-base (#fff) */',
    ...semanticGroupLines('text', semantic.text),
    '  /* Action / primary CTA */',
    ...semanticGroupLines('action', semantic.action),
    '  /* Intent — success */',
    ...semanticGroupLines('success', semantic.success),
    '  /* Intent — warning */',
    ...semanticGroupLines('warning', semantic.warning),
    '  /* Intent — danger */',
    ...semanticGroupLines('danger', semantic.danger),
    '  /* Intent — info */',
    ...semanticGroupLines('info', semantic.info),
    '}',
    '',
    '[data-theme="dark"] {',
    '  /* Backgrounds */',
    ...semanticGroupLines('bg', DARK_MODE.bg),
    '  /* Surfaces */',
    ...semanticGroupLines('surface', DARK_MODE.surface),
    '  /* Borders */',
    ...semanticGroupLines('border', DARK_MODE.border),
    '  /* Text — AA-contrast verified on bg-base (#030712) */',
    ...semanticGroupLines('text', DARK_MODE.text),
    '  /* Action / primary CTA */',
    ...semanticGroupLines('action', DARK_MODE.action),
    '  /* Intent — success (dark) */',
    ...semanticGroupLines('success', DARK_MODE.success),
    '  /* Intent — warning (dark) */',
    ...semanticGroupLines('warning', DARK_MODE.warning),
    '  /* Intent — danger (dark) */',
    ...semanticGroupLines('danger', DARK_MODE.danger),
    '  /* Intent — info (dark) */',
    ...semanticGroupLines('info', DARK_MODE.info),
    '  /* Dark-mode shadows need a tighter opacity (less ambient light) */',
    ...Object.entries(DARK_MODE.shadow).map(([key, val]) => `  --ds-shadow-${camelToKebab(key)}: ${val};`),
    '}',
    '',
    '/* Base reset / sensible defaults */',
    '*, *::before, *::after {',
    '  box-sizing: border-box;',
    '}',
    'img, svg, video, canvas, audio, iframe, embed, object {',
    '  max-width: 100%;',
    '}',
    'img, video, canvas, audio, iframe, embed, object {',
    '  display: block;',
    '}',
    'img, video {',
    '  height: auto;',
    '}',
    '.ds-min-0 {',
    '  min-inline-size: 0;',
    '  min-block-size: 0;',
    '}',
    '.ds-prose, p, li, dd, blockquote, figcaption {',
    '  overflow-wrap: break-word;',
    '}',
    '.ds-container {',
    '  max-inline-size: var(--ds-width-prose);',
    '  margin-inline: auto;',
    '}',
    '.ds-truncate {',
    '  overflow: hidden;',
    '  white-space: nowrap;',
    '  text-overflow: ellipsis;',
    '}',
    'html {',
    '  font-family: var(--ds-font-sans);',
    '  font-size: var(--ds-text-md);',
    '  line-height: var(--ds-leading-normal);',
    '  color: var(--ds-text-primary);',
    '  background-color: var(--ds-bg-base);',
    '  -webkit-font-smoothing: antialiased;',
    '  -moz-osx-font-smoothing: grayscale;',
    '}',
    ':focus-visible {',
    '  outline: 2px solid var(--ds-border-focus);',
    '  outline-offset: 2px;',
    '  box-shadow: var(--ds-shadow-focus);',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  *, *::before, *::after {',
    '    animation-duration: 0.01ms !important;',
    '    animation-iteration-count: 1 !important;',
    '    transition-duration: 0.01ms !important;',
    '  }',
    '}',
    '',
  ];
  return lines.join('\n');
}

export function renderDesignSystemTokens(root = ROOT) {
  const css = computeDesignSystemCss(root);
  const engine = resolvePaths(root).engine;
  const path = join(root, engine, 'design-system', 'tokens.css');
  const before = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (before === css) return { path: `${engine}/design-system/tokens.css`, status: 'unchanged' };
  writeFileSync(path, css, 'utf8');
  return { path: `${engine}/design-system/tokens.css`, status: 'written' };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = renderDesignSystemTokens();
  console.log(`design-system: ${result.status} ${result.path}`);
}
