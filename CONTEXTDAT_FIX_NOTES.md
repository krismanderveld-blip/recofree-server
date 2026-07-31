# Context.dat Fix Notes

## Problem
- Client builds contextDat (distilled) in gpt-payload-builder.ts (line 793-816)
- Client sends contextDat in openai-provider.ts (line 693-706)
- Server ai-chat.ts zod schema does NOT include contextDat field → zod strips it
- Server always falls back to full backpack injection in identityMemory (line 2309-2380)

## Fix Required

### 1. Add to zod schema (server/ai-chat.ts, around line 873)
```
contextDat: z.string().nullable().optional(),
deepeningBlock: z.string().nullable().optional(),
```

### 2. Add to ChatRequestInput interface (server/ai-chat.ts, around line 228)
```
contextDat?: string | null;
deepeningBlock?: string | null;
```

### 3. Modify SESSION_INIT prompt building (server/ai-chat.ts, line 2309+)
When input.contextDat exists:
- Use contextDat as identityMemory (it's already formatted as a compact prompt block)
- Append deepeningBlock if present
- Skip the full backpack life story injection
- Keep minimal intake context (name, userType, intakeDate)

When input.contextDat is absent (fallback):
- Keep current behavior (full backpack injection)

## What contextDat contains (from context-dat-distiller.ts)
- Compact life summary (names, key events, relationships)
- Active schemas + modes with confidence
- Trigger patterns (top 5)
- Stage of change
- Recent session themes
- Key figures with roles
- Emotional baseline

## Token savings
- Full backpack: ~3000-8000 tokens (depends on how much user wrote)
- contextDat: ~500-1000 tokens (fixed compact format)
- Savings: 60-85% reduction in identity memory tokens
