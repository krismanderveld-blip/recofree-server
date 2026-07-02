# Key Findings from Migration Analysis

## CRITICAL INSIGHT
The document says under Optie B:
> "De client bouwt al het correcte ChatRequestInput object (dat doet de lokale pipeline al voor de sandbox tRPC call). We sturen datzelfde object naar Railway."

This means the CLIENT PIPELINE already builds the full ChatRequestInput that ai-chat.ts expects.
The `sanitizedPayload` in openai-provider.ts IS the correct ChatRequestInput.

## The REAL problem
The current gpt-proxy on Railway calls `generateAIResponse(body)` which:
1. Calls `cacheSessionInit()` → builds session cache from backpack/userDat
2. Calls `buildSystemPrompt(input)` → 1354 lines of prompt construction
3. Calls OpenAI with the built messages

`buildSystemPrompt` IS part of ai-chat.ts which IS on the server.
The client does NOT build the system prompt locally.
The client builds `ChatRequestInput` (the structured data), NOT the messages array.

## What needs to happen for TRUE Option B
Railway needs `generateAIResponse()` to work — which means `buildSystemPrompt()` + `ai-chat.ts` must work on Railway.
The crashes happen because ai-chat.ts accesses properties without optional chaining.

## Alternative: Move buildSystemPrompt to client
If we move buildSystemPrompt to the client:
- Client builds messages array locally (system prompt + conversation)
- Railway only does: openai.chat.completions.create({ messages, model })
- Zero format issues possible

## What the user wants
- Engine stays on device (pipeline.ts = engine)
- buildSystemPrompt = part of the engine (it decides HOW to talk to the user)
- Server = ONLY the OpenAI API call
- So buildSystemPrompt MUST move to client
