import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { BlobStore } from '../platform';

/** Stores save bundles as plain files under a directory (mount it as a volume). */
export class FsBlobStore implements BlobStore {
  private root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private path(key: string) {
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root + sep)) throw new Error(`Invalid blob key: ${key}`);
    return p;
  }

  async put(key: string, data: ArrayBuffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmp, new Uint8Array(data));
    await rename(tmp, p); // atomic: readers never see a half-written save
  }

  async get(key: string) {
    const p = this.path(key);
    try {
      await stat(p);
    } catch {
      return null;
    }
    return Readable.toWeb(createReadStream(p)) as ReadableStream;
  }
}
