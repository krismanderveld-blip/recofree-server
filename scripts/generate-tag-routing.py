"""Generate tag-to-module routing map from short-module-prompts.ts"""
import re

with open('lib/engine/elias/short-module-prompts.ts', 'r') as f:
    content = f.read()

# Split by module entries
entries = re.split(r"  \{\n    id: '", content)[1:]
result = []
for entry in entries:
    m_id = entry[:3]  # e.g. M05
    tags_match = re.search(r'detected_tags bevat: ([^\n]+)', entry)
    if tags_match:
        tags = [t.strip() for t in tags_match.group(1).split(',')]
        result.append((m_id, tags))

# Generate TypeScript file
lines = []
lines.append('/**')
lines.append(' * Tag-to-Module routing map for Elias Short Modules (M05-M85)')
lines.append(' * Auto-generated from short-module-prompts.ts detected_tags.')
lines.append(' * Used by the pipeline to route detected tags to the correct short module.')
lines.append(' */')
lines.append('')
lines.append('/**')
lines.append(' * Maps a detected tag to its corresponding short module ID.')
lines.append(' * Multiple tags can map to the same module.')
lines.append(' */')
lines.append('export const SHORT_MODULE_TAG_MAP: Record<string, string> = {')
for m_id, tags in result:
    for tag in tags:
        lines.append(f"  '{tag}': '{m_id}',")
lines.append('};')
lines.append('')
lines.append('/**')
lines.append(' * Given a list of detected tags, find the best matching short module.')
lines.append(' * Returns the module ID with the most tag matches, or null if no match.')
lines.append(' */')
lines.append('export function findBestShortModule(detectedTags: string[]): string | null {')
lines.append('  const scores: Record<string, number> = {};')
lines.append('  for (const tag of detectedTags) {')
lines.append('    const moduleId = SHORT_MODULE_TAG_MAP[tag];')
lines.append('    if (moduleId) {')
lines.append('      scores[moduleId] = (scores[moduleId] || 0) + 1;')
lines.append('    }')
lines.append('  }')
lines.append('  let best: string | null = null;')
lines.append('  let bestScore = 0;')
lines.append('  for (const [moduleId, score] of Object.entries(scores)) {')
lines.append('    if (score > bestScore) {')
lines.append('      best = moduleId;')
lines.append('      bestScore = score;')
lines.append('    }')
lines.append('  }')
lines.append('  return best;')
lines.append('}')
lines.append('')

with open('lib/engine/elias/short-module-routing.ts', 'w') as f:
    f.write('\n'.join(lines))

print(f"Generated short-module-routing.ts with {len(result)} modules and {sum(len(t) for _, t in result)} tag entries")
