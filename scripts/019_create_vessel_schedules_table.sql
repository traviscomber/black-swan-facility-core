-- Create vessel_schedules table to store daily schedules for boats
CREATE TABLE IF NOT EXISTS public.vessel_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES ports_boats(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  departure_time time,
  arrival_time time,
  origin_port_id uuid REFERENCES ports_boats(id),
  destination_port_id uuid REFERENCES ports_boats(id),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'departed', 'arrived', 'cancelled')),
  capacity_used integer,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vessel_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all on vessel_schedules" ON public.vessel_schedules FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_vessel_schedules_vessel_id ON public.vessel_schedules(vessel_id);
CREATE INDEX idx_vessel_schedules_scheduled_date ON public.vessel_schedules(scheduled_date);
CREATE INDEX idx_vessel_schedules_status ON public.vessel_schedules(status);
