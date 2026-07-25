#!/usr/bin/env node
// Сканирует папку models/ и генерирует models/manifest.json.
// Каждый .glb становится дверью; парный .usdz (то же имя) идёт для AR,
// парная картинка (.jpg/.png/.webp) — превью для каталога.
//
// Необязательно: models/labels.json вида
//   { "wooden_door_v3": { "name": "Дуб Классик", "width": 900, "height": 2100 } }
// переопределяет название и номинальные размеры по id (= имя файла без расширения).
//
// Запуск:  node gen-manifest.mjs

import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dir = join(root, 'models');

const labelsPath = join(dir, 'labels.json');
const labels = existsSync(labelsPath) ? JSON.parse(readFileSync(labelsPath, 'utf8')) : {};

const prettify = (id) =>
  id.replace(/[_-]+/g, ' ').replace(/\bv?\d+\b/gi, '').trim()
    .replace(/^\w/, (c) => c.toUpperCase()) || id;

const files = readdirSync(dir);
const posterExt = ['.webp', '.jpg', '.jpeg', '.png'];

const doors = files
  .filter((f) => f.toLowerCase().endsWith('.glb'))
  .sort()
  .map((glb) => {
    const id = glb.replace(/\.glb$/i, '');
    const usdz = `${id}.usdz`;
    const poster = posterExt.map((e) => `${id}${e}`).find((p) => files.includes(p));
    const ov = labels[id] || {};
    return {
      id,
      name: ov.name || prettify(id),
      glb: `models/${glb}`,
      usdz: files.includes(usdz) ? `models/${usdz}` : '',
      poster: poster ? `models/${poster}` : '',
      width: ov.width || 900,
      height: ov.height || 2100,
    };
  });

writeFileSync(join(dir, 'manifest.json'), JSON.stringify(doors, null, 2) + '\n');
console.log(`manifest.json: ${doors.length} дверь(и)`);
doors.forEach((d) => console.log(`  • ${d.name}  (${d.glb}${d.usdz ? ' + usdz' : ' — БЕЗ usdz, AR на iPhone не будет'})`));
