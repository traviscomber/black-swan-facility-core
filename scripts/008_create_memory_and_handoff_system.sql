-- Phase 2: Memory Layer with Vector Search and Multi-Agent Handoff
-- Extends ADK Context Architecture with Memory and Agent Coordination

-- Memory Store with embeddings for semantic search
CREATE TABLE IF NOT EXISTS ai_memory_store (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- 'episodic', 'semantic', 'procedural'
  content TEXT NOT NULL,
  embedding vector(1536), -- For semantic search (OpenAI embeddings)
  metadata JSONB DEFAULT '{}',
  relevance_score FLOAT DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Agent Handoffs for multi-agent workflows
CREATE TABLE IF NOT EXISTS ai_agent_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_sessions(id) ON DELETE CASCADE,
  from_agent_id uuid REFERENCES ai_agents(id),
  to_agent_id uuid REFERENCES ai_agents(id),
  handoff_reason TEXT NOT NULL,
  context_snapshot JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'completed', 'rejected'
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Context Compaction Log
CREATE TABLE IF NOT EXISTS ai_context_compactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_sessions(id) ON DELETE CASCADE,
  compacted_count INTEGER NOT NULL,
  original_size_kb FLOAT,
  compacted_size_kb FLOAT,
  compression_ratio FLOAT,
  compaction_strategy TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_memory_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_compactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all on ai_memory_store" ON ai_memory_store FOR ALL USING (true);
CREATE POLICY "Allow all on ai_agent_handoffs" ON ai_agent_handoffs FOR ALL USING (true);
CREATE POLICY "Allow all on ai_context_compactions" ON ai_context_compactions FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_memory_store_agent ON ai_memory_store(agent_id);
CREATE INDEX idx_memory_store_type ON ai_memory_store(memory_type);
CREATE INDEX idx_memory_store_accessed ON ai_memory_store(last_accessed DESC);
CREATE INDEX idx_handoffs_session ON ai_agent_handoffs(session_id);
CREATE INDEX idx_handoffs_status ON ai_agent_handoffs(status);

-- Sample episodic memories
INSERT INTO ai_memory_store (agent_id, memory_type, content, metadata, relevance_score) 
SELECT id, 'episodic', 'Successfully optimized 15 maintenance tasks by analyzing asset usage patterns', 
  '{"outcome": "success", "tasks_count": 15}'::jsonb, 0.95
FROM ai_agents WHERE type = 'maintenance' LIMIT 1;

INSERT INTO ai_memory_store (agent_id, memory_type, content, metadata, relevance_score) 
SELECT id, 'episodic', 'Resolved critical water pump issue by creating maintenance task', 
  '{"outcome": "success", "issue_type": "critical"}'::jsonb, 0.92
FROM ai_agents WHERE type = 'issue_resolution' LIMIT 1;

-- Sample semantic memory
INSERT INTO ai_memory_store (agent_id, memory_type, content, metadata) 
SELECT id, 'semantic', 'Water pumps require weekly maintenance during high usage periods', 
  '{"category": "maintenance_schedule", "asset_type": "water_pump"}'::jsonb
FROM ai_agents WHERE type = 'maintenance' LIMIT 1;
