"""Agent executor - runs LangGraph agent for a node."""

import uuid
from datetime import datetime
from typing import Any, Optional

import structlog
from langgraph.graph import StateGraph, END
from litellm import acompletion

from shared.db import Database

logger = structlog.get_logger()


class AgentState:
    """State for the agent execution."""

    def __init__(
        self,
        node_id: str,
        execution_id: str,
        inputs: list[dict],
        messages: list[dict] = None,
        outputs: list[dict] = None,
        sub_nodes_created: list[str] = None,
        current_step: str = "start",
        human_input_needed: bool = False,
        human_input_request: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        self.node_id = node_id
        self.execution_id = execution_id
        self.inputs = inputs
        self.messages = messages or []
        self.outputs = outputs or []
        self.sub_nodes_created = sub_nodes_created or []
        self.current_step = current_step
        self.human_input_needed = human_input_needed
        self.human_input_request = human_input_request
        self.error = error

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "execution_id": self.execution_id,
            "inputs": self.inputs,
            "messages": self.messages,
            "outputs": self.outputs,
            "sub_nodes_created": self.sub_nodes_created,
            "current_step": self.current_step,
            "human_input_needed": self.human_input_needed,
            "human_input_request": self.human_input_request,
            "error": self.error,
        }


class AgentExecutor:
    """Executes an agent for a node using LangGraph."""

    def __init__(
        self,
        db: Database,
        node_id: str,
        execution_id: str,
        org_config: dict,
    ):
        self.db = db
        self.node_id = node_id
        self.execution_id = execution_id
        self.org_config = org_config
        self.model = org_config.get("model", "gpt-4-turbo-preview")
        self.tools = self._build_tools()
        self.total_tokens_in = 0
        self.total_tokens_out = 0

    def _build_tools(self) -> list[dict]:
        """Build the tools available to the agent."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "create_subnode",
                    "description": "Create a sub-node to decompose this task into smaller parts",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Title of the sub-node",
                            },
                            "description": {
                                "type": "string",
                                "description": "Description of what this sub-node should accomplish",
                            },
                            "author_type": {
                                "type": "string",
                                "enum": ["agent", "human"],
                                "description": "Whether this should be done by an agent or assigned to a human",
                            },
                        },
                        "required": ["title", "author_type"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "add_output",
                    "description": "Add an output to this node",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["text", "structured_data", "file"],
                                "description": "Type of output",
                            },
                            "content": {
                                "type": "string",
                                "description": "The output content (text or JSON string)",
                            },
                            "label": {
                                "type": "string",
                                "description": "Label for the output",
                            },
                        },
                        "required": ["type", "content"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "request_human_input",
                    "description": "Request input or clarification from the human supervisor",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "question": {
                                "type": "string",
                                "description": "The question to ask",
                            },
                            "options": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Optional list of suggested answers",
                            },
                        },
                        "required": ["question"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "mark_complete",
                    "description": "Mark this node as complete",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "summary": {
                                "type": "string",
                                "description": "Brief summary of what was accomplished",
                            },
                        },
                        "required": ["summary"],
                    },
                },
            },
        ]

    async def run(self) -> None:
        """Run the agent execution."""
        # Update status to running
        await self._update_status("running")
        await self._log_event("execution_start", {"model": self.model})

        try:
            # Load node and inputs
            node = await self._load_node()
            inputs = await self._load_inputs()

            # Build initial state
            state = AgentState(
                node_id=self.node_id,
                execution_id=self.execution_id,
                inputs=inputs,
            )

            # Build system message
            system_message = self._build_system_message(node, inputs)
            state.messages.append({"role": "system", "content": system_message})

            # Run the agent loop
            max_iterations = 20
            iteration = 0

            while iteration < max_iterations:
                iteration += 1
                logger.info(
                    "Agent iteration",
                    iteration=iteration,
                    execution_id=self.execution_id,
                )

                # Call LLM
                response = await self._call_llm(state.messages)

                # Process response
                assistant_message = response.choices[0].message
                state.messages.append(assistant_message.model_dump())

                # Check for tool calls
                if assistant_message.tool_calls:
                    for tool_call in assistant_message.tool_calls:
                        result = await self._execute_tool(tool_call, state)

                        # Add tool result to messages
                        state.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": result,
                        })

                        # Check if we should stop
                        if state.human_input_needed:
                            await self._update_status("paused")
                            return

                        if state.current_step == "complete":
                            await self._update_status("complete")
                            return
                else:
                    # No tool calls - check if done
                    if "complete" in assistant_message.content.lower():
                        await self._update_status("complete")
                        return

            # Max iterations reached
            await self._log_event("error", {"message": "Max iterations reached"})
            await self._update_status("failed", "Max iterations reached")

        except Exception as e:
            logger.error("Agent execution failed", error=str(e))
            await self._log_event("error", {"message": str(e)})
            await self._update_status("failed", str(e))
            raise

    async def _call_llm(self, messages: list[dict]) -> Any:
        """Call the LLM."""
        start_time = datetime.utcnow()

        response = await acompletion(
            model=self.model,
            messages=messages,
            tools=self.tools,
            tool_choice="auto",
            api_key=self.org_config.get("api_key"),
            api_base=self.org_config.get("api_base"),
        )

        # Track tokens
        usage = response.usage
        self.total_tokens_in += usage.prompt_tokens
        self.total_tokens_out += usage.completion_tokens

        # Log the event
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        await self._log_event(
            "llm_call",
            {
                "model": self.model,
                "tokens_in": usage.prompt_tokens,
                "tokens_out": usage.completion_tokens,
            },
            duration_ms=duration_ms,
            tokens_in=usage.prompt_tokens,
            tokens_out=usage.completion_tokens,
        )

        return response

    async def _execute_tool(self, tool_call: Any, state: AgentState) -> str:
        """Execute a tool call."""
        import json

        name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)

        logger.info("Executing tool", tool=name, args=args)
        await self._log_event("tool_call", {"tool": name, "arguments": args})

        if name == "create_subnode":
            return await self._create_subnode(args, state)
        elif name == "add_output":
            return await self._add_output(args, state)
        elif name == "request_human_input":
            return await self._request_human_input(args, state)
        elif name == "mark_complete":
            state.current_step = "complete"
            return f"Node marked as complete: {args.get('summary', '')}"
        else:
            return f"Unknown tool: {name}"

    async def _create_subnode(self, args: dict, state: AgentState) -> str:
        """Create a sub-node."""
        node_id = str(uuid.uuid4())

        await self.db.execute(
            """
            INSERT INTO nodes (id, org_id, project_id, parent_id, title, description, author_type, status)
            SELECT $1, org_id, project_id, $2, $3, $4, $5, 'draft'
            FROM nodes WHERE id = $2
            """,
            node_id,
            self.node_id,
            args["title"],
            args.get("description"),
            args["author_type"],
        )

        state.sub_nodes_created.append(node_id)
        await self._log_event("subnode_created", {"subnode_id": node_id, **args})

        return f"Created sub-node: {args['title']} (id: {node_id})"

    async def _add_output(self, args: dict, state: AgentState) -> str:
        """Add an output to the node."""
        import json

        output_id = str(uuid.uuid4())
        output_type = args["type"]
        content = args["content"]

        if output_type == "structured_data":
            await self.db.execute(
                """
                INSERT INTO node_outputs (id, node_id, output_type, structured_data, label)
                VALUES ($1, $2, $3, $4, $5)
                """,
                output_id,
                self.node_id,
                output_type,
                json.loads(content) if isinstance(content, str) else content,
                args.get("label"),
            )
        else:
            await self.db.execute(
                """
                INSERT INTO node_outputs (id, node_id, output_type, text_content, label)
                VALUES ($1, $2, $3, $4, $5)
                """,
                output_id,
                self.node_id,
                output_type,
                content,
                args.get("label"),
            )

        state.outputs.append({"id": output_id, **args})
        await self._log_event("output_added", {"output_id": output_id, **args})

        return f"Added output: {args.get('label', output_type)}"

    async def _request_human_input(self, args: dict, state: AgentState) -> str:
        """Request human input."""
        state.human_input_needed = True
        state.human_input_request = args
        await self._log_event("human_input_requested", args)

        return "Human input requested. Pausing execution."

    async def _load_node(self) -> dict:
        """Load the node from the database."""
        row = await self.db.fetchrow(
            "SELECT * FROM nodes WHERE id = $1",
            self.node_id,
        )
        return dict(row) if row else {}

    async def _load_inputs(self) -> list[dict]:
        """Load the node inputs."""
        rows = await self.db.fetch(
            """
            SELECT ni.*, f.filename, f.extracted_text
            FROM node_inputs ni
            LEFT JOIN files f ON ni.file_id = f.id
            WHERE ni.node_id = $1
            ORDER BY ni.sort_order
            """,
            self.node_id,
        )
        return [dict(row) for row in rows]

    def _build_system_message(self, node: dict, inputs: list[dict]) -> str:
        """Build the system message for the agent."""
        inputs_text = "\n".join(
            f"- {inp.get('label', inp.get('input_type'))}: {inp.get('text_content') or inp.get('extracted_text') or inp.get('external_url', 'N/A')}"
            for inp in inputs
        )

        return f"""You are an AI agent working on a task in GlassBox, a collaborative workspace.

Task: {node.get('title', 'Untitled')}
Description: {node.get('description', 'No description provided')}

Available inputs:
{inputs_text or 'No inputs provided'}

You have access to the following tools:
1. create_subnode - Break down this task into smaller sub-tasks
2. add_output - Add outputs (text, structured data, or files)
3. request_human_input - Ask the human supervisor for clarification
4. mark_complete - Mark this task as complete

Work through the task step by step. If the task is complex, break it into sub-nodes.
When you have completed the task, use mark_complete with a summary."""

    async def _update_status(self, status: str, error: str = None) -> None:
        """Update the execution status."""
        await self.db.execute(
            """
            UPDATE agent_executions
            SET status = $1,
                error_message = $2,
                total_tokens_in = $3,
                total_tokens_out = $4,
                completed_at = CASE WHEN $1 IN ('complete', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
            WHERE id = $5
            """,
            status,
            error,
            self.total_tokens_in,
            self.total_tokens_out,
            self.execution_id,
        )

    async def _log_event(
        self,
        event_type: str,
        event_data: dict,
        duration_ms: int = None,
        tokens_in: int = None,
        tokens_out: int = None,
    ) -> None:
        """Log a trace event."""
        import json

        await self.db.execute(
            """
            INSERT INTO agent_trace_events
            (id, execution_id, event_type, event_data, duration_ms, model, tokens_in, tokens_out)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            str(uuid.uuid4()),
            self.execution_id,
            event_type,
            json.dumps(event_data),
            duration_ms,
            self.model if event_type == "llm_call" else None,
            tokens_in,
            tokens_out,
        )
