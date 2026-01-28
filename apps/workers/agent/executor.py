"""Agent executor - runs LangGraph agent for a node."""

import json
import uuid
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

import structlog
from litellm import acompletion

from shared.db import Database
from shared.s3 import S3Client, generate_output_key

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
        iteration: int = 0,
        human_input_needed: bool = False,
        human_input_request: Optional[dict] = None,
        human_input_response: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        self.node_id = node_id
        self.execution_id = execution_id
        self.inputs = inputs
        self.messages = messages or []
        self.outputs = outputs or []
        self.sub_nodes_created = sub_nodes_created or []
        self.current_step = current_step
        self.iteration = iteration
        self.human_input_needed = human_input_needed
        self.human_input_request = human_input_request
        self.human_input_response = human_input_response
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
            "iteration": self.iteration,
            "human_input_needed": self.human_input_needed,
            "human_input_request": self.human_input_request,
            "human_input_response": self.human_input_response,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AgentState":
        return cls(
            node_id=data.get("node_id", ""),
            execution_id=data.get("execution_id", ""),
            inputs=data.get("inputs", []),
            messages=data.get("messages", []),
            outputs=data.get("outputs", []),
            sub_nodes_created=data.get("sub_nodes_created", []),
            current_step=data.get("current_step", "start"),
            iteration=data.get("iteration", 0),
            human_input_needed=data.get("human_input_needed", False),
            human_input_request=data.get("human_input_request"),
            human_input_response=data.get("human_input_response"),
            error=data.get("error"),
        )


class AgentExecutor:
    """Executes an agent for a node using LangGraph."""

    def __init__(
        self,
        db: Database,
        node_id: str,
        execution_id: str,
        org_config: dict,
        org_id: Optional[str] = None,
    ):
        self.db = db
        self.node_id = node_id
        self.execution_id = execution_id
        self.org_config = org_config
        self.org_id = org_id  # Will be loaded from node if not provided
        self.model = org_config.get("defaultModel") or org_config.get("model", "gpt-4-turbo-preview")
        self.tools = self._build_tools()
        self.total_tokens_in = 0
        self.total_tokens_out = 0
        self.s3 = S3Client()

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

    async def _check_execution_status(self) -> tuple[str, Optional[dict]]:
        """Check current execution status and human input response.

        Returns (status, human_input_response) tuple.
        """
        row = await self.db.fetchrow(
            "SELECT status, langgraph_checkpoint FROM agent_executions WHERE id = $1",
            self.execution_id,
        )
        if not row:
            return "cancelled", None

        status = row["status"]
        checkpoint_data = row.get("langgraph_checkpoint")

        # Extract human input response from checkpoint if present
        human_input_response = None
        if checkpoint_data:
            try:
                checkpoint = json.loads(checkpoint_data) if isinstance(checkpoint_data, str) else checkpoint_data
                human_input_response = checkpoint.get("humanInputResponse")
            except (json.JSONDecodeError, TypeError):
                pass

        return status, human_input_response

    async def _save_checkpoint(self, state: AgentState) -> None:
        """Save current state to checkpoint for resume."""
        checkpoint = {
            "messages": state.messages,
            "iteration": state.iteration,
            "outputs": state.outputs,
            "subNodesCreated": state.sub_nodes_created,
            "currentStep": state.current_step,
            "humanInputRequest": state.human_input_request,
            "humanInputResponse": state.human_input_response,
        }

        await self.db.execute(
            """
            UPDATE agent_executions
            SET langgraph_checkpoint = $1,
                total_tokens_in = $2,
                total_tokens_out = $3
            WHERE id = $4
            """,
            json.dumps(checkpoint),
            self.total_tokens_in,
            self.total_tokens_out,
            self.execution_id,
        )
        logger.info("Checkpoint saved", execution_id=self.execution_id, iteration=state.iteration)

    async def _load_checkpoint(self) -> Optional[dict]:
        """Load checkpoint if exists."""
        row = await self.db.fetchrow(
            "SELECT langgraph_checkpoint, total_tokens_in, total_tokens_out FROM agent_executions WHERE id = $1",
            self.execution_id,
        )
        if row and row.get("langgraph_checkpoint"):
            checkpoint_data = row["langgraph_checkpoint"]
            try:
                checkpoint = json.loads(checkpoint_data) if isinstance(checkpoint_data, str) else checkpoint_data
                # Restore token counts
                self.total_tokens_in = row.get("total_tokens_in") or 0
                self.total_tokens_out = row.get("total_tokens_out") or 0
                return checkpoint
            except (json.JSONDecodeError, TypeError):
                pass
        return None

    async def run(self) -> None:
        """Run the agent execution."""
        # Check if this is a resume (has checkpoint)
        checkpoint = await self._load_checkpoint()
        is_resume = checkpoint is not None

        # Update status to running
        await self._update_status("running")

        if is_resume:
            await self._log_event("execution_resume", {"model": self.model, "iteration": checkpoint.get("iteration", 0)})
        else:
            await self._log_event("execution_start", {"model": self.model})

        try:
            # Load node and inputs
            node = await self._load_node()
            inputs = await self._load_inputs()

            # Set org_id from node if not provided
            if not self.org_id and node.get("org_id"):
                self.org_id = str(node["org_id"])

            # Build or restore state
            if is_resume and checkpoint:
                state = AgentState(
                    node_id=self.node_id,
                    execution_id=self.execution_id,
                    inputs=inputs,
                    messages=checkpoint.get("messages", []),
                    outputs=checkpoint.get("outputs", []),
                    sub_nodes_created=checkpoint.get("subNodesCreated", []),
                    current_step=checkpoint.get("currentStep", "start"),
                    iteration=checkpoint.get("iteration", 0),
                    human_input_response=checkpoint.get("humanInputResponse"),
                )

                # If we have human input response, add it to messages
                if state.human_input_response:
                    state.messages.append({
                        "role": "user",
                        "content": f"Human response: {json.dumps(state.human_input_response)}",
                    })
                    state.human_input_response = None  # Clear after processing
                    await self._log_event("human_input_received", {"response": state.human_input_response})
            else:
                state = AgentState(
                    node_id=self.node_id,
                    execution_id=self.execution_id,
                    inputs=inputs,
                )
                # Build system message for fresh start
                system_message = self._build_system_message(node, inputs)
                state.messages.append({"role": "system", "content": system_message})
                # Add initial user message (required for Anthropic)
                state.messages.append({
                    "role": "user",
                    "content": f"Please begin working on this task: {node.get('title', 'Untitled')}. Analyze the inputs provided and use your tools to complete the work.",
                })

            # Run the agent loop
            max_iterations = 20

            while state.iteration < max_iterations:
                state.iteration += 1

                # Check status before each iteration (pause/cancel support)
                current_status, human_response = await self._check_execution_status()

                if current_status == "cancelled":
                    logger.info("Execution cancelled", execution_id=self.execution_id)
                    await self._log_event("execution_cancelled", {})
                    return

                if current_status == "paused":
                    logger.info("Execution paused, saving checkpoint", execution_id=self.execution_id)
                    await self._save_checkpoint(state)
                    await self._log_event("execution_paused", {"iteration": state.iteration})
                    return

                # If we received human input while awaiting, process it
                if human_response and current_status == "running":
                    state.messages.append({
                        "role": "user",
                        "content": f"Human response: {json.dumps(human_response)}",
                    })
                    await self._log_event("human_input_received", {"response": human_response})
                    # Clear the checkpoint's human input response
                    await self._save_checkpoint(state)

                logger.info(
                    "Agent iteration",
                    iteration=state.iteration,
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

                        # Check if we need human input
                        if state.human_input_needed:
                            await self._save_checkpoint(state)
                            await self._update_status("awaiting_input")
                            await self._log_event("awaiting_human_input", state.human_input_request)
                            return

                        # Check if we're done
                        if state.current_step == "complete":
                            await self._update_status("complete")
                            await self._log_event("execution_complete", {"summary": "Task completed"})
                            return
                else:
                    # No tool calls - check if done
                    if assistant_message.content and "complete" in assistant_message.content.lower():
                        await self._update_status("complete")
                        await self._log_event("execution_complete", {"summary": assistant_message.content[:200]})
                        return

                # Save checkpoint after each iteration for crash recovery
                await self._save_checkpoint(state)

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
            api_key=self.org_config.get("apiKey") or self.org_config.get("api_key"),
            api_base=self.org_config.get("apiBase") or self.org_config.get("api_base"),
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
        """Add an output to the node - uploads all content to S3.

        All outputs (text, structured_data, file) are stored in S3 for:
        - Auditability and compliance
        - Preventing database bloat
        - Consistent retrieval via presigned URLs
        """
        output_id = str(uuid.uuid4())
        file_id = str(uuid.uuid4())
        output_type = args["type"]
        content = args["content"]
        label = args.get("label", output_type)

        # Determine content type and extension based on output type
        if output_type == "structured_data":
            content_type = "application/json"
            extension = "json"
            # Parse and re-serialize for consistent formatting
            if isinstance(content, str):
                content = json.loads(content)
        elif output_type == "text":
            content_type = "text/plain"
            extension = "txt"
        else:  # file type - content should describe the file or be base64
            content_type = "application/octet-stream"
            extension = "bin"

        # Generate S3 key for this output
        s3_key = generate_output_key(
            org_id=UUID(self.org_id),
            execution_id=UUID(self.execution_id),
            output_type=output_type,
            extension=extension,
        )

        # Upload to S3
        await self.s3.upload(
            content=content,
            key=s3_key,
            content_type=content_type,
            metadata={
                "execution_id": self.execution_id,
                "node_id": self.node_id,
                "output_type": output_type,
                "label": label,
            },
        )

        # Calculate content size
        if isinstance(content, dict):
            size_bytes = len(json.dumps(content).encode("utf-8"))
        elif isinstance(content, str):
            size_bytes = len(content.encode("utf-8"))
        else:
            size_bytes = len(content)

        # Create file record in database
        from shared.config import get_settings
        settings = get_settings()

        await self.db.execute(
            """
            INSERT INTO files (id, org_id, storage_key, storage_bucket, filename, content_type, size_bytes, processing_status, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'complete', $8)
            """,
            file_id,
            self.org_id,
            s3_key,
            settings.s3_bucket,
            f"{label}.{extension}",
            content_type,
            size_bytes,
            json.dumps({
                "source": "agent_output",
                "execution_id": self.execution_id,
                "node_id": self.node_id,
                "output_type": output_type,
            }),
        )

        # Create node_output record linking to the file
        await self.db.execute(
            """
            INSERT INTO node_outputs (id, node_id, output_type, file_id, label, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            output_id,
            self.node_id,
            output_type,
            file_id,
            label,
            json.dumps({"s3_key": s3_key}),
        )

        state.outputs.append({"id": output_id, "file_id": file_id, "s3_key": s3_key, **args})
        await self._log_event("output_added", {
            "output_id": output_id,
            "file_id": file_id,
            "s3_key": s3_key,
            "size_bytes": size_bytes,
            **args,
        })

        logger.info(
            "Output uploaded to S3",
            output_id=output_id,
            file_id=file_id,
            s3_key=s3_key,
            size_bytes=size_bytes,
        )

        return f"Added output: {label} (stored in S3)"

    async def _request_human_input(self, args: dict, state: AgentState) -> str:
        """Request human input - sets awaiting_input status."""
        state.human_input_needed = True
        state.human_input_request = {
            "requestType": "question",
            "prompt": args["question"],
            "options": args.get("options", []),
        }
        await self._log_event("human_input_requested", args)

        return "Human input requested. Execution will pause until input is provided."

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
        # Determine if we should set completed_at
        is_terminal = status in ('complete', 'failed', 'cancelled')

        if status == "running":
            await self.db.execute(
                """
                UPDATE agent_executions
                SET status = $1,
                    error_message = $2,
                    total_tokens_in = $3,
                    total_tokens_out = $4,
                    started_at = COALESCE(started_at, NOW())
                WHERE id = $5
                """,
                status,
                error,
                self.total_tokens_in,
                self.total_tokens_out,
                self.execution_id,
            )
        elif is_terminal:
            await self.db.execute(
                """
                UPDATE agent_executions
                SET status = $1,
                    error_message = $2,
                    total_tokens_in = $3,
                    total_tokens_out = $4,
                    completed_at = NOW()
                WHERE id = $5
                """,
                status,
                error,
                self.total_tokens_in,
                self.total_tokens_out,
                self.execution_id,
            )
        else:
            await self.db.execute(
                """
                UPDATE agent_executions
                SET status = $1,
                    error_message = $2,
                    total_tokens_in = $3,
                    total_tokens_out = $4
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
