"""
CEO-Assist core agent.

Uses Claude Opus 4.6 with adaptive thinking and tool use.
Streaming is used for all responses to handle long outputs without timeouts.
The agentic loop continues until Claude stops requesting tools.
"""
import json
import logging
from typing import AsyncIterator, List, Optional

import anthropic

from config.settings import settings
from security.audit_log import audit_logger
from .system_prompt import get_system_prompt
from .tools import get_all_tools, TOOL_REGISTRY

logger = logging.getLogger(__name__)

MAX_TOOL_ITERATIONS = 10  # Prevent infinite loops


class CEOAssistAgent:
    """Stateful agent that maintains conversation history per session."""

    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._tools = get_all_tools()
        self._conversation: List[dict] = []

    def reset_conversation(self) -> None:
        """Clear conversation history (start fresh)."""
        self._conversation = []

    def get_conversation(self) -> List[dict]:
        """Return a copy of the conversation history."""
        return list(self._conversation)

    async def chat_stream(self, user_message: str) -> AsyncIterator[str]:
        """
        Send a message and stream the response back token by token.
        Handles the full tool-use agentic loop internally.
        Yields text chunks as they arrive.
        """
        self._conversation.append({"role": "user", "content": user_message})
        audit_logger.log("user_message", "chat", {"length": len(user_message)})

        iteration = 0
        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1
            full_content = []
            stop_reason = None

            # Stream this turn
            async with self._client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=8192,
                thinking={"type": "adaptive"},
                system=get_system_prompt(),
                tools=self._tools,
                messages=self._conversation,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        # Signal thinking to UI
                        if event.content_block.type == "thinking":
                            yield "\n\n*[Thinking...]*\n\n"
                    elif event.type == "content_block_delta":
                        if event.delta.type == "text_delta":
                            yield event.delta.text
                    elif event.type == "message_delta":
                        stop_reason = event.delta.stop_reason

                final_message = await stream.get_final_message()
                full_content = final_message.content
                stop_reason = final_message.stop_reason

            # Append assistant turn to history
            self._conversation.append({"role": "assistant", "content": full_content})

            if stop_reason != "tool_use":
                break  # Done — Claude has no more tool calls

            # Execute tool calls
            tool_results = []
            for block in full_content:
                if block.type != "tool_use":
                    continue
                tool_name = block.name
                tool_input = block.input
                tool_id = block.id

                # Announce tool call to UI
                yield f"\n\n> **Using tool:** `{tool_name}`...\n\n"
                audit_logger.log_tool_call(tool_name, tool_input)

                # Execute
                fn = TOOL_REGISTRY.get(tool_name)
                if fn is None:
                    result_text = f"Error: Unknown tool '{tool_name}'"
                else:
                    try:
                        result_text = await fn(**tool_input)
                    except Exception as exc:
                        logger.error("Tool '%s' raised: %s", tool_name, exc, exc_info=True)
                        result_text = f"Tool error: {exc}"

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": str(result_text),
                })

            # Feed tool results back
            self._conversation.append({"role": "user", "content": tool_results})

        if iteration >= MAX_TOOL_ITERATIONS:
            yield "\n\n*[Max tool iterations reached — stopping]*\n"

    async def quick_response(self, user_message: str) -> str:
        """Non-streaming version for simple queries. Returns full response text."""
        chunks = []
        async for chunk in self.chat_stream(user_message):
            chunks.append(chunk)
        return "".join(chunks)


# Global agent instance per process
_agent_instance: Optional[CEOAssistAgent] = None


def get_agent() -> CEOAssistAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = CEOAssistAgent()
    return _agent_instance
