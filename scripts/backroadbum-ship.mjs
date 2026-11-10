import { resolve } from 'node:path';
import { stageShipArtifact } from './lib/backroadbum-ship.mjs';
console.log(stageShipArtifact(resolve(import.meta.dirname, '..')));
