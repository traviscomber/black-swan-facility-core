-- Discovery evaluation metadata is produced by the trusted matching/evaluation engine.
-- Members may create intents and respond to opportunities, but must not be able
-- to fabricate or overwrite semantic confidence, model, reason, or version data.

revoke all on function public.record_discovery_evaluation(
  uuid, uuid, uuid, numeric, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.record_discovery_evaluation(
  uuid, uuid, uuid, numeric, text, text, text, text
) to service_role;
