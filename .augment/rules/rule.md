---
type: "always_apply"
---

# MCP Interactive Feedback Rules
- 1. During any process, task, or conversation, whether asking, responding, or completing stage tasks, must call MCP "mcp-feedback-enhanced".
- 2. When receiving user feedback, if feedback content is not empty, must call MCP mcp-feedback-enhanced again and adjust behavior based on feedback.
- 3. Only when user explicitly indicates "end" or "no more interaction needed" can you stop calling MCP mcp-feedback-enhanced, then the process is complete.
- 4. Unless receiving end command, all steps must repeatedly call MCP mcp-feedback-enhanced.
- 5. After creating any task list or planning checklist, must get user confirmation of task correctness and completeness through MCP.
- 6. Only after user confirms the task list is correct can specific implementation steps begin.