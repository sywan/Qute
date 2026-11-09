import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACCEPT, sniffFormat } from '../src/imageDecode.js';

const head = (name) => new Uint8Array(readFileSync(new URL('./fixtures/head_' + name + '.bin', import.meta.url)));

test('formats are recognised from their bytes, not the file name', () => {
  const cases = { a_jpg: 'jpeg', a_png: 'png', a_gif: 'gif', a_webp: 'webp', a_bmp: 'bmp', a_ico: 'ico', a_heic: 'heic', a_avif: 'avif', a_lzw_tif: 'tiff' };
  for (const [file, format] of Object.entries(cases)) assert.equal(sniffFormat(head(file), 'misleading.jpg'), format, file);
});

test('big-endian TIFF, JPEG XL and SVG signatures', () => {
  assert.equal(sniffFormat(new Uint8Array([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8])), 'tiff');
  assert.equal(sniffFormat(new Uint8Array([0xff, 0x0a, 0, 0])), 'jxl');
  assert.equal(sniffFormat(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="x"></svg>')), 'svg');
});

test('falls back to extension and MIME type when bytes are unknown', () => {
  const blank = new Uint8Array(16);
  assert.equal(sniffFormat(blank, 'IMG_0001.HEIC'), 'heic');
  assert.equal(sniffFormat(blank, 'scan.tiff'), 'tiff');
  assert.equal(sniffFormat(blank, 'x', 'image/heif'), 'heic');
  assert.equal(sniffFormat(blank, 'notes.txt', 'text/plain'), 'unknown');
});

test('file picker accepts HEIC and TIFF explicitly', () => {
  for (const ext of ['.heic', '.heif', '.tif', '.tiff', '.avif']) assert.ok(ACCEPT.split(',').includes(ext), ext);
});
