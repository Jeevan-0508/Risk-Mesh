// Read committed public catalogue files only. Never scan local documents, keys or risk registers.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { writeFileSync } from 'node:fs';
const root = resolve(process.argv[2] || '..');
const sources = [];
function read(repo, path) {
  const cwd = join(root, repo);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const bytes = execFileSync('git', ['show', `${revision}:${path}`], { cwd, maxBuffer: 4_000_000 });
  const data = JSON.parse(bytes.toString('utf8'));
  const source_id = `${repo}:${path}`;
  sources.push({ source_id, repository: `Jeevan-0508/${repo}`, path, revision,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    url: `https://github.com/Jeevan-0508/${repo}/blob/${revision}/${path}`,
    data_class: 'authored_repository_catalogue', authenticity: 'git_bytes_not_independent_factual_verification' });
  return { data, source_id };
}
const taxonomy = read('freight-fraud-taxonomy', 'docs/data.json');
const frameworks = read('ai-governance-control-room', 'docs/frameworks.json');
const controls = read('ai-governance-control-room', 'docs/controls.json');
const dora = read('dora-compliance-scanner', 'docs/requirements.json');
const snapshot = {
  schema_version: 'mesh-repository-state.v1', captured_at: new Date().toISOString(), sources,
  taxonomy: { version: taxonomy.data.meta.version, source_id: taxonomy.source_id,
    patterns: taxonomy.data.patterns.map(({ id, name, summary, severity, category, indicators, countermeasures }) =>
      ({ id, name, summary, severity, category, indicators, countermeasures })) },
  governance: { frameworks: frameworks.data.frameworks, controls: controls.data.controls,
    dora: dora.data, source_ids: [frameworks.source_id, controls.source_id, dora.source_id],
    interpretation: 'Authored paraphrases and internal control mappings. Legal applicability and control effectiveness are unassessed.' },
  limits: ['Committed snapshots; no live incidents or trend time series.',
    'Authored severity is not empirical frequency, loss or probability.',
    'Governance catalogue references do not establish applicable law or implemented control coverage.'],
};
writeFileSync(new URL('../data/repository-state.js', import.meta.url), `// Generated from committed repository files.\nexport default ${JSON.stringify(snapshot, null, 2)};\n`);
console.log(`Captured ${snapshot.taxonomy.patterns.length} patterns and ${snapshot.governance.controls.length} authored control mappings from ${sources.length} committed files.`);
