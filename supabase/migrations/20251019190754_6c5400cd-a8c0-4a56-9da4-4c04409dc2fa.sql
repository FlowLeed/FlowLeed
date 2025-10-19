-- Create helper function to track AI usage
CREATE OR REPLACE FUNCTION increment_ai_stat(
  org_id UUID,
  stat_column TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO organization_activity_stats (
    organization_id,
    date,
    ai_messages_generated,
    ai_suggestions_used,
    ai_descriptions_generated,
    total_ai_uses
  ) VALUES (
    org_id,
    CURRENT_DATE,
    CASE WHEN stat_column = 'ai_messages_generated' THEN 1 ELSE 0 END,
    CASE WHEN stat_column = 'ai_suggestions_used' THEN 1 ELSE 0 END,
    CASE WHEN stat_column = 'ai_descriptions_generated' THEN 1 ELSE 0 END,
    1
  )
  ON CONFLICT (organization_id, date) 
  DO UPDATE SET
    ai_messages_generated = organization_activity_stats.ai_messages_generated + 
      CASE WHEN stat_column = 'ai_messages_generated' THEN 1 ELSE 0 END,
    ai_suggestions_used = organization_activity_stats.ai_suggestions_used + 
      CASE WHEN stat_column = 'ai_suggestions_used' THEN 1 ELSE 0 END,
    ai_descriptions_generated = organization_activity_stats.ai_descriptions_generated + 
      CASE WHEN stat_column = 'ai_descriptions_generated' THEN 1 ELSE 0 END,
    total_ai_uses = organization_activity_stats.total_ai_uses + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;