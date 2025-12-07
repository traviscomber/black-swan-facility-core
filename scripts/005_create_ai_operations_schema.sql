-- AI Operations Tables for Black Swan Facility Core
-- Based on Omar Sar's AI Operations Framework

-- Agent definitions and configurations
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'maintenance', 'issue_resolution', 'documentation', 'communication', 'execution'
  description TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'disabled'
  config JSONB DEFAULT '{}', -- Agent-specific configuration
  last_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Agent execution history
CREATE TABLE IF NOT EXISTS ai_agent_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);

-- Agent memory and state
CREATE TABLE IF NOT EXISTS ai_agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- 'short_term', 'long_term', 'context'
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP
);

-- AI-generated automation rules
CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL, -- 'schedule', 'event', 'threshold'
  trigger_config JSONB NOT NULL,
  action_type TEXT NOT NULL, -- 'create_task', 'send_alert', 'update_status'
  action_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- AI operation logs
CREATE TABLE IF NOT EXISTS ai_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  execution_id uuid REFERENCES ai_agent_executions(id) ON DELETE CASCADE,
  log_level TEXT DEFAULT 'info', -- 'debug', 'info', 'warn', 'error'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_operation_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now)
CREATE POLICY "Allow all on ai_agents" ON ai_agents FOR ALL USING (true);
CREATE POLICY "Allow all on ai_agent_executions" ON ai_agent_executions FOR ALL USING (true);
CREATE POLICY "Allow all on ai_agent_memory" ON ai_agent_memory FOR ALL USING (true);
CREATE POLICY "Allow all on ai_automation_rules" ON ai_automation_rules FOR ALL USING (true);
CREATE POLICY "Allow all on ai_operation_logs" ON ai_operation_logs FOR ALL USING (true);

-- Seed initial AI agents
INSERT INTO ai_agents (name, type, description, status) VALUES
('Maintenance Scheduler', 'maintenance', 'Automatically schedules and optimizes maintenance tasks based on asset usage patterns', 'active'),
('Issue Triager', 'issue_resolution', 'Analyzes and categorizes incoming issues, suggests solutions, and auto-assigns priority', 'active'),
('Documentation Generator', 'documentation', 'Creates SOPs, manuals, and checklists from maintenance logs and asset data', 'active'),
('Alert Manager', 'communication', 'Sends intelligent notifications and status updates to team members', 'active'),
('Task Executor', 'execution', 'Executes automated actions like QR generation, status updates, and data synchronization', 'active');
