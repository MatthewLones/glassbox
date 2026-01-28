"""
Full End-to-End Execution Test for GlassBox Agent

This test demonstrates:
1. Task execution with inputs
2. LLM reasoning and tool use
3. Subnode creation (task decomposition)
4. Output generation (stored in S3)
5. HITL (Human-in-the-Loop) capability
6. Full trace/evidence logging

Run from apps/workers directory:
    source .venv/bin/activate && python test_full_execution.py
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, ".")

# Force model to Anthropic
MODEL = "anthropic/claude-sonnet-4-20250514"

from shared.db import Database
from shared.s3 import S3Client
from agent.executor import AgentExecutor, AgentState


async def setup_test_data(db):
    """Create test node with inputs for execution."""
    node_id = str(uuid.uuid4())
    
    # Create test node with a task that should trigger multiple capabilities
    await db.execute("""
        INSERT INTO nodes (id, org_id, project_id, title, description, author_type, status)
        VALUES ($1, '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
                'Product Launch Analysis',
                'Analyze the following product launch requirements and create a structured execution plan. Break down into sub-tasks if the work is complex. Provide your analysis as structured output.',
                'agent', 'draft')
    """, node_id)
    
    # Add text input with requirements
    input_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO node_inputs (id, node_id, input_type, text_content, label)
        VALUES ($1, $2, 'text', $3, 'Product Requirements')
    """, input_id, node_id, """
Product: GlassBox AI Workspace
Launch Target: Q2 2026

Key Features:
1. Collaborative AI canvas for team workflows
2. Human-in-the-loop agent supervision
3. Full audit trail and evidence logging
4. Enterprise SSO integration

Launch Checklist Needed:
- Marketing materials
- Technical documentation  
- Sales enablement
- Customer onboarding flow
    """)
    
    return node_id


async def run_test():
    """Run the full execution test."""
    # Check for API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    
    # Create fresh database connection
    db = Database()
    await db.connect()
    
    s3 = S3Client()
    
    print("=" * 60)
    print("GLASSBOX AGENT EXECUTION TEST")
    print("=" * 60)
    print(f"\nModel: {MODEL}")
    print(f"Anthropic Key: {'configured' if api_key else 'NOT CONFIGURED'}")
    print()
    
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set in environment")
        print("Set it in apps/workers/.env file")
        return
    
    # Setup test data
    print("Setting up test node with inputs...")
    node_id = await setup_test_data(db)
    execution_id = str(uuid.uuid4())
    org_id = "11111111-1111-1111-1111-111111111111"
    
    print(f"  Node ID: {node_id}")
    print(f"  Execution ID: {execution_id}")
    print()
    
    # Create execution record
    await db.execute("""
        INSERT INTO agent_executions (id, node_id, status, model_id)
        VALUES ($1, $2, 'pending', $3)
    """, execution_id, node_id, MODEL)
    
    # Create executor with explicit model
    executor = AgentExecutor(
        db=db,
        node_id=node_id,
        execution_id=execution_id,
        org_config={
            "defaultModel": MODEL,
        },
        org_id=org_id,
    )
    
    print("Starting agent execution...")
    print("-" * 60)
    
    start_time = datetime.now(timezone.utc)
    
    try:
        await executor.run()
        status = "complete"
    except Exception as e:
        print(f"\nExecution error: {e}")
        status = "failed"
        import traceback
        traceback.print_exc()
    
    end_time = datetime.now(timezone.utc)
    duration = (end_time - start_time).total_seconds()
    
    print("-" * 60)
    print(f"\nExecution completed in {duration:.1f}s")
    print()
    
    # Fetch final execution state
    execution = await db.fetchrow("""
        SELECT status, total_tokens_in, total_tokens_out, error_message
        FROM agent_executions WHERE id = $1
    """, execution_id)
    
    print("=" * 60)
    print("EXECUTION RESULTS")
    print("=" * 60)
    print(f"\nStatus: {execution['status']}")
    print(f"Tokens In: {execution['total_tokens_in']}")
    print(f"Tokens Out: {execution['total_tokens_out']}")
    if execution['error_message']:
        print(f"Error: {execution['error_message']}")
    print()
    
    # Fetch trace events
    print("=" * 60)
    print("TRACE EVENTS (Evidence Log)")
    print("=" * 60)
    
    events = await db.fetch("""
        SELECT event_type, event_data, duration_ms, tokens_in, tokens_out, timestamp
        FROM agent_trace_events 
        WHERE execution_id = $1
        ORDER BY sequence_number
    """, execution_id)
    
    for i, event in enumerate(events, 1):
        event_data = json.loads(event['event_data']) if isinstance(event['event_data'], str) else event['event_data']
        print(f"\n[{i}] {event['event_type'].upper()}")
        print(f"    Time: {event['timestamp']}")
        if event['duration_ms']:
            print(f"    Duration: {event['duration_ms']}ms")
        if event['tokens_in']:
            print(f"    Tokens: {event['tokens_in']} in / {event['tokens_out']} out")
        
        # Print relevant event data
        if event['event_type'] == 'tool_call':
            print(f"    Tool: {event_data.get('tool')}")
            if 'arguments' in event_data:
                args = event_data['arguments']
                if 'title' in args:
                    print(f"    Title: {args['title']}")
                if 'label' in args:
                    print(f"    Label: {args['label']}")
                if 'question' in args:
                    print(f"    Question: {args['question']}")
        elif event['event_type'] == 'subnode_created':
            print(f"    Subnode: {event_data.get('title')}")
            print(f"    Author: {event_data.get('author_type')}")
        elif event['event_type'] == 'output_added':
            print(f"    Output: {event_data.get('label')} ({event_data.get('type')})")
            print(f"    S3 Key: {event_data.get('s3_key')}")
            print(f"    Size: {event_data.get('size_bytes')} bytes")
        elif event['event_type'] == 'human_input_requested':
            print(f"    Question: {event_data.get('question')}")
            if event_data.get('options'):
                print(f"    Options: {event_data.get('options')}")
    
    # Fetch subnodes created
    print("\n" + "=" * 60)
    print("SUBNODES CREATED")
    print("=" * 60)
    
    subnodes = await db.fetch("""
        SELECT id, title, description, author_type, status
        FROM nodes
        WHERE parent_id = $1
        ORDER BY created_at
    """, node_id)
    
    if subnodes:
        for node in subnodes:
            print(f"\n  [{node['author_type'].upper()}] {node['title']}")
            print(f"    ID: {node['id']}")
            if node['description']:
                desc = node['description'][:100] + "..." if len(node['description']) > 100 else node['description']
                print(f"    Description: {desc}")
    else:
        print("\n  No subnodes created")
    
    # Fetch outputs
    print("\n" + "=" * 60)
    print("OUTPUTS (Stored in S3)")
    print("=" * 60)
    
    outputs = await db.fetch("""
        SELECT no.id, no.output_type, no.label, no.metadata, f.storage_key, f.size_bytes, f.content_type
        FROM node_outputs no
        JOIN files f ON no.file_id = f.id
        WHERE no.node_id = $1
        ORDER BY no.created_at
    """, node_id)
    
    if outputs:
        for output in outputs:
            print(f"\n  {output['label']} ({output['output_type']})")
            print(f"    S3 Key: {output['storage_key']}")
            print(f"    Size: {output['size_bytes']} bytes")
            print(f"    Content-Type: {output['content_type']}")
            
            # Download and show preview
            try:
                content = await s3.download(output['storage_key'])
                text = content.decode('utf-8')
                # Pretty print JSON
                if output['content_type'] == 'application/json':
                    try:
                        parsed = json.loads(text)
                        text = json.dumps(parsed, indent=2)
                    except:
                        pass
                preview = text[:800]
                if len(text) > 800:
                    preview += "\n      ..."
                print(f"    Content:\n      {preview.replace(chr(10), chr(10) + '      ')}")
            except Exception as e:
                print(f"    Content: (error downloading: {e})")
    else:
        print("\n  No outputs created")
    
    # Cleanup
    await db.disconnect()
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    print(f"\nTo explore further:")
    print(f"  - Execution ID: {execution_id}")
    print(f"  - Node ID: {node_id}")
    print(f"  - Check S3: aws --endpoint-url=http://localhost:4566 s3 ls s3://glassbox-files-dev/outputs/{org_id}/{execution_id}/ --recursive")


if __name__ == "__main__":
    asyncio.run(run_test())
