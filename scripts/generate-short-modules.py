#!/usr/bin/env python3
"""
Generate Elias Short Module Prompt Blocks (M05-M85) from spec files.
Outputs: lib/engine/elias/short-module-prompts.ts
"""
import re
import glob

# Parse all spec files and extract full module content for prompt blocks
spec_files = sorted(glob.glob('/home/ubuntu/upload/RECOFREE_SHORT_MODULE_SPECS_*.txt'))
spec_files.append('/home/ubuntu/upload/RECOFREE_SHORT_MODULE_SPEC_55_ELIAS_ONLY_MANUS_READY.txt')

all_modules = []

for f in spec_files:
    with open(f) as fh:
        content = fh.read()
    
    # Split by MODULE separator
    sections = re.split(r'={60,}\n(MODULE \d+ - .+?)\n={60,}', content)
    
    # sections[0] is header, then alternating: title, content
    for i in range(1, len(sections), 2):
        header = sections[i]
        body = sections[i+1] if i+1 < len(sections) else ''
        
        id_match = re.search(r'MODULE_ID:\n(\w+)', body)
        title_match = re.search(r'MODULE_TITLE_HUMAN:\n(.+)', body)
        desc_match = re.search(r'BESCHRIJVING:\n(.+?)(?=\nFUNCTIEDOEL:)', body, re.DOTALL)
        goal_match = re.search(r'FUNCTIEDOEL:\n(.+?)(?=\nTRIGGERCRITERIA:)', body, re.DOTALL)
        trigger_match = re.search(r'TRIGGERCRITERIA:\n(.+?)(?=\nRESPONSLOGICA)', body, re.DOTALL)
        response_match = re.search(r'RESPONSLOGICA.+?:\n(.+?)(?=\nVoorbeeldrespons:)', body, re.DOTALL)
        example_match = re.search(r'Voorbeeldrespons:\n(.+?)(?=\nFORBIDDEN OUTPUT:)', body, re.DOTALL)
        forbidden_match = re.search(r'FORBIDDEN OUTPUT:\n(.+?)(?=\nETHISCHE NOOT:)', body, re.DOTALL)
        ethics_match = re.search(r'ETHISCHE NOOT:\n(.+?)(?=\n={60,}|\Z)', body, re.DOTALL)
        
        if id_match and title_match:
            mid = id_match.group(1)
            title = title_match.group(1).strip()
            
            # Build prompt block
            prompt_parts = []
            prompt_parts.append(f"MODULE {mid}: {title.upper()}")
            
            if desc_match:
                prompt_parts.append(f"BESCHRIJVING: {desc_match.group(1).strip()}")
            
            if goal_match:
                prompt_parts.append(f"DOEL: {goal_match.group(1).strip()}")
            
            if trigger_match:
                prompt_parts.append(f"TRIGGERS: {trigger_match.group(1).strip()}")
            
            if response_match:
                prompt_parts.append(f"RESPONSLOGICA: {response_match.group(1).strip()}")
            
            if example_match:
                prompt_parts.append(f"VOORBEELD: {example_match.group(1).strip()}")
            
            if forbidden_match:
                prompt_parts.append(f"VERBODEN: {forbidden_match.group(1).strip()}")
            
            if ethics_match:
                prompt_parts.append(f"ETHIEK: {ethics_match.group(1).strip()}")
            
            prompt_block = '\n'.join(prompt_parts)
            all_modules.append((mid, title, prompt_block))

# Sort by module number
all_modules.sort(key=lambda x: int(x[0][1:]))
print(f"Total prompt blocks generated: {len(all_modules)}")

# Generate TypeScript file with all prompt blocks
ts_lines = []
ts_lines.append("/**")
ts_lines.append(" * Elias Short Module Prompt Blocks (M05-M85)")
ts_lines.append(" * Full therapeutic prompt blocks for injection into buildSystemPrompt().")
ts_lines.append(" * ELIAS ONLY - these modules are not used by Kim.")
ts_lines.append(" */")
ts_lines.append("")
ts_lines.append("export interface ShortModulePromptBlock {")
ts_lines.append("  readonly id: string;")
ts_lines.append("  readonly name: string;")
ts_lines.append("  readonly promptBlock: string;")
ts_lines.append("}")
ts_lines.append("")
ts_lines.append("export const ELIAS_SHORT_MODULE_PROMPTS: readonly ShortModulePromptBlock[] = [")

for mid, title, prompt_block in all_modules:
    # Escape for TypeScript template literal
    escaped = prompt_block.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    title_escaped = title.replace('`', '\\`')
    ts_lines.append("  {")
    ts_lines.append(f"    id: '{mid}',")
    ts_lines.append(f"    name: `{title_escaped}`,")
    ts_lines.append(f"    promptBlock: `{escaped}`,")
    ts_lines.append("  },")

ts_lines.append("];")
ts_lines.append("")
ts_lines.append("/**")
ts_lines.append(" * Get all short module prompt blocks as a single string for injection into system prompt.")
ts_lines.append(" * Only injected for Elias, never for Kim.")
ts_lines.append(" */")
ts_lines.append("export function getEliasShortModulePrompts(): string {")
ts_lines.append("  return ELIAS_SHORT_MODULE_PROMPTS.map(m => m.promptBlock).join('\\n\\n');")
ts_lines.append("}")
ts_lines.append("")
ts_lines.append("/**")
ts_lines.append(" * Get module list for clinical mode disclosure (name + short description).")
ts_lines.append(" */")
ts_lines.append("export function getEliasShortModuleList(): string {")
ts_lines.append("  return ELIAS_SHORT_MODULE_PROMPTS.map(m => `- \\${m.id}: \\${m.name}`).join('\\n');")
ts_lines.append("}")
ts_lines.append("")

output_path = '/home/ubuntu/recofree-app/lib/engine/elias/short-module-prompts.ts'
with open(output_path, 'w') as f:
    f.write('\n'.join(ts_lines))

print(f"Written to: {output_path}")
# Count lines
with open(output_path) as f:
    line_count = sum(1 for _ in f)
print(f"Lines: {line_count}")
