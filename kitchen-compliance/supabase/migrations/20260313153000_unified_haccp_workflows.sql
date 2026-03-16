-- Unified HACCP lifecycle model
-- Adds first-class cooking, cooling, reheating, and hot-hold workflows
-- while preserving legacy cooling tables for rollback/reference.

CREATE OR REPLACE FUNCTION public.user_can_access_site(target_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      target_site_id IN (SELECT venue_id FROM public.venue_members WHERE user_id = auth.uid())
      OR target_site_id IN (SELECT id FROM public.venues WHERE created_by = auth.uid())
      OR (
        auth.uid() = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
        AND target_site_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid
      )
    );
$$;

CREATE TABLE IF NOT EXISTS public.haccp_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  item_category text NOT NULL DEFAULT 'other',
  source_workflow_id uuid,
  current_workflow_id uuid,
  location_kind text NOT NULL DEFAULT 'unknown'
    CHECK (location_kind IN ('kitchen', 'fridge', 'hot_hold', 'service', 'unknown')),
  location_id uuid,
  location_label text,
  last_temperature numeric(4,1),
  last_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.haccp_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.haccp_batches(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  workflow_kind text NOT NULL
    CHECK (workflow_kind IN ('cooking', 'cooling', 'reheating', 'hot_hold')),
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'awaiting_completion', 'completed', 'needs_action', 'discarded', 'cancelled')),
  parent_workflow_id uuid REFERENCES public.haccp_workflows(id) ON DELETE SET NULL,
  title text NOT NULL,
  item_name text NOT NULL,
  item_category text NOT NULL DEFAULT 'other',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  due_at timestamptz,
  next_due_at timestamptz,
  revalidation_interval_minutes integer,
  start_temperature numeric(4,1),
  end_temperature numeric(4,1),
  last_temperature numeric(4,1),
  severity text CHECK (severity IN ('pass', 'warning', 'critical')),
  corrective_action text CHECK (corrective_action IN ('reheat', 'discard', 'manual_override')),
  notes text,
  location_kind text NOT NULL DEFAULT 'unknown'
    CHECK (location_kind IN ('kitchen', 'fridge', 'hot_hold', 'service', 'unknown')),
  location_id uuid,
  location_label text,
  started_by_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  started_by_name text,
  completed_by_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  completed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.haccp_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.haccp_workflows(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.haccp_batches(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (
      event_type IN (
        'workflow_started',
        'temperature_logged',
        'workflow_completed',
        'transition_requested',
        'transition_completed',
        'reminder_due',
        'corrective_action_required',
        'corrective_action_taken',
        'workflow_cancelled'
      )
    ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.haccp_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.haccp_workflows(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.haccp_batches(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('hot_hold_check')),
  due_at timestamptz NOT NULL,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  delivery_state text NOT NULL DEFAULT 'scheduled'
    CHECK (delivery_state IN ('scheduled', 'due', 'delivered', 'acknowledged', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_haccp_batches_site_id ON public.haccp_batches(site_id);
CREATE INDEX IF NOT EXISTS idx_haccp_batches_item_name ON public.haccp_batches(site_id, item_name);
CREATE INDEX IF NOT EXISTS idx_haccp_workflows_site_state ON public.haccp_workflows(site_id, state);
CREATE INDEX IF NOT EXISTS idx_haccp_workflows_site_kind_state ON public.haccp_workflows(site_id, workflow_kind, state);
CREATE INDEX IF NOT EXISTS idx_haccp_workflows_batch_id ON public.haccp_workflows(batch_id);
CREATE INDEX IF NOT EXISTS idx_haccp_workflows_started_at ON public.haccp_workflows(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_haccp_workflows_due_at ON public.haccp_workflows(due_at);
CREATE INDEX IF NOT EXISTS idx_haccp_workflows_next_due_at ON public.haccp_workflows(next_due_at);
CREATE INDEX IF NOT EXISTS idx_haccp_workflow_events_workflow_id ON public.haccp_workflow_events(workflow_id);
CREATE INDEX IF NOT EXISTS idx_haccp_workflow_events_site_created_at ON public.haccp_workflow_events(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_haccp_reminders_due_state ON public.haccp_reminders(site_id, delivery_state, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_haccp_reminders_workflow_id_unique ON public.haccp_reminders(workflow_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_site_user ON public.push_subscriptions(site_id, user_id);

DROP TRIGGER IF EXISTS set_haccp_batches_updated_at ON public.haccp_batches;
CREATE TRIGGER set_haccp_batches_updated_at
  BEFORE UPDATE ON public.haccp_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_haccp_workflows_updated_at ON public.haccp_workflows;
CREATE TRIGGER set_haccp_workflows_updated_at
  BEFORE UPDATE ON public.haccp_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER set_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.haccp_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haccp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haccp_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haccp_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "haccp_batches_select" ON public.haccp_batches;
CREATE POLICY "haccp_batches_select" ON public.haccp_batches
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_batches_insert" ON public.haccp_batches;
CREATE POLICY "haccp_batches_insert" ON public.haccp_batches
  FOR INSERT WITH CHECK (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_batches_update" ON public.haccp_batches;
CREATE POLICY "haccp_batches_update" ON public.haccp_batches
  FOR UPDATE USING (public.user_can_access_site(site_id))
  WITH CHECK (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_batches_delete" ON public.haccp_batches;
CREATE POLICY "haccp_batches_delete" ON public.haccp_batches
  FOR DELETE USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_workflows_select" ON public.haccp_workflows;
CREATE POLICY "haccp_workflows_select" ON public.haccp_workflows
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_workflows_insert" ON public.haccp_workflows;
CREATE POLICY "haccp_workflows_insert" ON public.haccp_workflows
  FOR INSERT WITH CHECK (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_workflows_update" ON public.haccp_workflows;
CREATE POLICY "haccp_workflows_update" ON public.haccp_workflows
  FOR UPDATE USING (public.user_can_access_site(site_id))
  WITH CHECK (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_workflows_delete" ON public.haccp_workflows;
CREATE POLICY "haccp_workflows_delete" ON public.haccp_workflows
  FOR DELETE USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_workflow_events_select" ON public.haccp_workflow_events;
CREATE POLICY "haccp_workflow_events_select" ON public.haccp_workflow_events
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_workflow_events_insert" ON public.haccp_workflow_events;
CREATE POLICY "haccp_workflow_events_insert" ON public.haccp_workflow_events
  FOR INSERT WITH CHECK (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_workflow_events_delete" ON public.haccp_workflow_events;
CREATE POLICY "haccp_workflow_events_delete" ON public.haccp_workflow_events
  FOR DELETE USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_reminders_select" ON public.haccp_reminders;
CREATE POLICY "haccp_reminders_select" ON public.haccp_reminders
  FOR SELECT USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_reminders_insert" ON public.haccp_reminders;
CREATE POLICY "haccp_reminders_insert" ON public.haccp_reminders
  FOR INSERT WITH CHECK (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_reminders_update" ON public.haccp_reminders;
CREATE POLICY "haccp_reminders_update" ON public.haccp_reminders
  FOR UPDATE USING (public.user_can_access_site(site_id))
  WITH CHECK (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "haccp_reminders_delete" ON public.haccp_reminders;
CREATE POLICY "haccp_reminders_delete" ON public.haccp_reminders
  FOR DELETE USING (public.user_can_access_site(site_id));

DROP POLICY IF EXISTS "push_subscriptions_select" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select" ON public.push_subscriptions
  FOR SELECT USING (
    public.user_can_access_site(site_id)
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "push_subscriptions_insert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (
    public.user_can_access_site(site_id)
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "push_subscriptions_update" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update" ON public.push_subscriptions
  FOR UPDATE USING (
    public.user_can_access_site(site_id)
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.user_can_access_site(site_id)
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "push_subscriptions_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete" ON public.push_subscriptions
  FOR DELETE USING (
    public.user_can_access_site(site_id)
    AND user_id = auth.uid()
  );

CREATE TEMP TABLE _haccp_cooling_backfill (
  legacy_session_id uuid PRIMARY KEY,
  batch_id uuid NOT NULL,
  workflow_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO _haccp_cooling_backfill (legacy_session_id, batch_id, workflow_id)
SELECT id, gen_random_uuid(), gen_random_uuid()
FROM public.cooling_sessions;

INSERT INTO public.haccp_batches (
  id,
  site_id,
  item_name,
  item_category,
  current_workflow_id,
  location_kind,
  location_label,
  last_temperature,
  last_recorded_at,
  created_at,
  updated_at
)
SELECT
  backfill.batch_id,
  session.site_id,
  session.item_name,
  COALESCE(session.item_category, 'other'),
  backfill.workflow_id,
  CASE
    WHEN session.close_action = 'in_fridge' THEN 'fridge'
    ELSE 'kitchen'
  END,
  CASE
    WHEN session.close_action = 'in_fridge' THEN 'Fridge'
    ELSE 'Kitchen'
  END,
  COALESCE(session.end_temperature, session.start_temperature),
  COALESCE(session.closed_at, session.started_at),
  COALESCE(session.created_at, session.started_at, now()),
  COALESCE(session.updated_at, session.closed_at, session.started_at, now())
FROM public.cooling_sessions AS session
JOIN _haccp_cooling_backfill AS backfill
  ON backfill.legacy_session_id = session.id;

INSERT INTO public.haccp_workflows (
  id,
  batch_id,
  site_id,
  workflow_kind,
  state,
  title,
  item_name,
  item_category,
  started_at,
  completed_at,
  due_at,
  start_temperature,
  end_temperature,
  last_temperature,
  location_kind,
  location_label,
  started_by_id,
  started_by_name,
  completed_by_id,
  completed_by_name,
  notes,
  created_at,
  updated_at
)
SELECT
  backfill.workflow_id,
  backfill.batch_id,
  session.site_id,
  'cooling',
  CASE
    WHEN session.close_action = 'discarded' OR session.status = 'discarded' THEN 'discarded'
    WHEN session.status = 'overdue' THEN 'needs_action'
    WHEN session.closed_at IS NOT NULL OR session.status = 'closed' THEN 'completed'
    ELSE 'active'
  END,
  session.item_name || ' cooling',
  session.item_name,
  COALESCE(session.item_category, 'other'),
  session.started_at,
  session.closed_at,
  session.hard_due_at,
  session.start_temperature,
  session.end_temperature,
  COALESCE(session.end_temperature, session.start_temperature),
  CASE
    WHEN session.close_action = 'in_fridge' THEN 'fridge'
    ELSE 'kitchen'
  END,
  CASE
    WHEN session.close_action = 'in_fridge' THEN 'Fridge'
    ELSE 'Kitchen'
  END,
  session.started_by_id,
  session.staff_name,
  session.closed_by_id,
  session.closed_by,
  session.exception_reason,
  COALESCE(session.created_at, session.started_at, now()),
  COALESCE(session.updated_at, session.closed_at, session.started_at, now())
FROM public.cooling_sessions AS session
JOIN _haccp_cooling_backfill AS backfill
  ON backfill.legacy_session_id = session.id;

INSERT INTO public.haccp_workflow_events (
  workflow_id,
  batch_id,
  site_id,
  event_type,
  payload,
  created_at
)
SELECT
  backfill.workflow_id,
  backfill.batch_id,
  session.site_id,
  'workflow_started',
  jsonb_build_object(
    'legacy_session_id', session.id,
    'legacy_source', 'cooling_sessions_backfill',
    'start_temperature', session.start_temperature
  ),
  COALESCE(session.started_at, session.created_at, now())
FROM public.cooling_sessions AS session
JOIN _haccp_cooling_backfill AS backfill
  ON backfill.legacy_session_id = session.id;

INSERT INTO public.haccp_workflow_events (
  workflow_id,
  batch_id,
  site_id,
  event_type,
  payload,
  created_at
)
SELECT
  backfill.workflow_id,
  backfill.batch_id,
  event.site_id,
  CASE event.event_type
    WHEN 'closed' THEN 'workflow_completed'
    WHEN 'discarded' THEN 'corrective_action_taken'
    WHEN 'exception_added' THEN 'corrective_action_required'
    WHEN 'warning_triggered' THEN 'corrective_action_required'
    WHEN 'overdue_triggered' THEN 'corrective_action_required'
    ELSE 'temperature_logged'
  END,
  COALESCE(event.payload, '{}'::jsonb)
    || jsonb_build_object('legacy_event_type', event.event_type),
  COALESCE(event.timestamp, event.created_at, now())
FROM public.cooling_events AS event
JOIN _haccp_cooling_backfill AS backfill
  ON backfill.legacy_session_id = event.session_id
WHERE event.event_type <> 'started';
