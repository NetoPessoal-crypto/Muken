#!/usr/bin/env node
/**
 * Upload local training file to Supabase Storage
 * Usage:
 * node scripts/push_training_to_storage.mjs --url <SUPABASE_URL> --key <SERVICE_ROLE_KEY> --bucket training --object training/training.md --in src/content/training.md
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
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
  const inPath = argv.in || 'src/content/training.md';

  if (!supabaseUrl || !serviceKey) {
    console.error('Supabase URL and service role key are required. Provide --url and --key or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(2);
  }

  if (!fs.existsSync(inPath)) {
    console.error('Input file not found:', inPath);
    process.exit(3);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const content = fs.readFileSync(inPath);
  try {
    // try upload (upsert)
    const { data, error } = await supabase.storage.from(bucket).upload(objectPath, content, { upsert: true });
    if (error) {
      console.error('Upload error:', error.message || error);
      process.exit(4);
    }
    console.log('Uploaded to', `${bucket}/${objectPath}`);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('/push_training_to_storage.mjs')) {
  main();
}
