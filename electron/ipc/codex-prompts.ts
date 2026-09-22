export type CodexMode = 'review' | 'plan' | 'research'

/** Codex answers in Korean; each mode pins a fixed output shape. */
export function buildPrompt(mode: CodexMode, input: string, context?: string): string {
  if (mode === 'review') {
    return `You are a precise code reviewer. Respond in Korean using polite formal speech.\n\nReview the following target and use this format:\n## Verdict\n[SHIP | NEEDS-FIX | DISCUSS]\n\n## Findings\n[List severity, file:line, and description]\n\n## What I checked\n[Brief bullets]\n\n<review_target>\n${input}\n</review_target>`
  }
  if (mode === 'plan') {
    return `You are a senior software planner. Respond in Korean using polite formal speech. Inspect the project files and current git worktree when useful. Do not change files. Use this format:\n## Goal\n[Desired outcome]\n\n## Current state\n[Relevant architecture, files, and constraints]\n\n## Plan\n[Ordered implementation steps with concrete file paths]\n\n## Risks and decisions\n[Tradeoffs, edge cases, and open questions]\n\n## Verification\n[Commands and checks to run]\n\n<planning_request>\n${input}\n</planning_request>${context ? `\n<planning_context>\n${context}\n</planning_context>` : ''}`
  }
  return `You are a technical researcher. Respond in Korean using polite formal speech. Lead with the direct answer, cite official URLs and versions when relevant, and state uncertainty explicitly.\n\n<user_question>\n${input}\n</user_question>${context ? `\n<research_context>\n${context}\n</research_context>` : ''}`
}
