import {execFileSync} from 'node:child_process';
import{build}from'esbuild';import{mkdir,copyFile}from'node:fs/promises';await mkdir('dist/assistant',{recursive:true});await build({entryPoints:['src/engine.ts'],outfile:'dist/assistant/engine.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});await copyFile('data/prepared/catalog.json','dist/assistant/catalog.json');console.log('Built backend and browser-local scientific engine.');

for(const file of ['app.mjs','scene.mjs','engine.mjs','ask-firetrace.mjs'])execFileSync(process.execPath,['--check','dist/assets/'+file]);

// Ship the extracted visual components and their existing local dependencies.
await (await import('node:fs/promises')).cp('public/components','dist/components',{recursive:true});
