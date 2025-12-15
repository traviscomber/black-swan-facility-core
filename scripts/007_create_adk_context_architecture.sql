-- Google ADK Context Architecture - Phase 1
-- Tiered context model: Sessions, Events, Context, Artifacts

-- AI Sessions table - Track conversation/operation sessions
CREATE TABLE IF NOT EXISTS ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  context_summary JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- AI Events table - Track discrete events within sessions
CREATE TABLE IF NOT EXISTS ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  context_snapshot JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- AI Context table - Structured context storage with compaction
CREATE TABLE IF NOT EXISTS ai_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_sessions(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  context_data JSONB NOT NULL,
  priority INTEGER DEFAULT 5,
  is_compacted BOOLEAN DEFAULT false,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- AI Artifacts table - Documents, images, logs, manuals
CREATE TABLE IF NOT EXISTS ai_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ai_sessions(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_artifacts ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist before creating (prevents duplicate policy errors)
DROP POLICY IF EXISTS "Allow all on ai_sessions" ON ai_sessions;
DROP POLICY IF EXISTS "Allow all on ai_events" ON ai_events;
DROP POLICY IF EXISTS "Allow all on ai_context" ON ai_context;
DROP POLICY IF EXISTS "Allow all on ai_artifacts" ON ai_artifacts;

-- Create policies
CREATE POLICY "Allow all on ai_sessions" ON ai_sessions FOR ALL USING (true);
CREATE POLICY "Allow all on ai_events" ON ai_events FOR ALL USING (true);
CREATE POLICY "Allow all on ai_context" ON ai_context FOR ALL USING (true);
CREATE POLICY "Allow all on ai_artifacts" ON ai_artifacts FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_sessions_agent ON ai_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_status ON ai_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ai_events_session ON ai_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_session ON ai_context(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_artifacts_session ON ai_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_artifacts_type ON ai_artifacts(artifact_type);

-- Seed sample artifacts
INSERT INTO ai_artifacts (artifact_type, title, content, tags) VALUES
('document', 'Facility Maintenance Guide', 'Standard operating procedures for facility maintenance...', ARRAY['maintenance', 'sop']),
('document', 'Emergency Procedures', 'Emergency response protocols for all facility staff...', ARRAY['emergency', 'safety']),
('log', 'System Activity Log', 'Historical system operations and patterns...', ARRAY['system', 'history']);
