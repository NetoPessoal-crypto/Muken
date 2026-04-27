#!/usr/bin/env node
/**
 * downloads a markdown file from Supabase Storage and writes it to the repo
 * Usage:
 *  node scripts/sync_training_from_storage.mjs --url <SUPABASE_URL> --key <SERVICE_ROLE_KEY> --bucket training --object training/training.md --out src/content/training.md [--commit]
 * If --commit is passed the script will run 'git add' and 'git commit' locally (use with care).
 */
import fs from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key === 'commit') { out.commit = true; continue; }
      const val = args[i+1];
      out[key] = val; i++;
    }
  }
  return out;
}

async function main() {
  const argv = parseArgs();
  const supabaseUrl = argv.url || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = argv.key || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const bucket = argv.bucket || 'training';
  const objectPath = argv.object || 'training/training.md';
  const outPath = argv.out || 'src/content/training.md';

  if (!supabaseUrl || !serviceKey) {
    console.error('Supabase URL and service role key are required. Provide --url and --key or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(2);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  console.log(`Downloading ${objectPath} from bucket ${bucket}...`);
  try {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error) {
      console.error('Download error:', error.message || error);
      process.exit(3);
    }
    const text = await data.text();
    fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text, 'utf8');
    console.log('Wrote to', outPath);

    if (argv.commit) {
      const message = argv.message || `sync: update ${outPath} from supabase storage (${bucket}/${objectPath})`;
      console.log('Creating git commit...');
      try {
        execSync(`git add "${outPath}"`, { stdio: 'inherit' });
        execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
        console.log('Committed changes.');
      } catch (err) {
        console.error('Git commit failed:', err.message || err);
        process.exit(4);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('/sync_training_from_storage.mjs')) {
  main();
}
