-- Create function to auto-update onboarding progress when PCO list mapping is created
CREATE OR REPLACE FUNCTION update_onboarding_on_list_mapping()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the organization_id from the integration and update onboarding progress
  UPDATE organizations o
  SET onboarding_progress = jsonb_set(
    COALESCE(onboarding_progress, '{}'::jsonb),
    '{pco_lists_mapped}',
    'true'::jsonb
  )
  FROM integrations i
  WHERE i.id = NEW.integration_id
    AND i.organization_id = o.id
    AND COALESCE((o.onboarding_progress->>'pco_lists_mapped')::boolean, false) = false;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to fire after list mapping insert
CREATE TRIGGER trigger_update_onboarding_on_list_mapping
AFTER INSERT ON integration_list_mappings
FOR EACH ROW
EXECUTE FUNCTION update_onboarding_on_list_mapping();

-- Also update pco_connected when integration is created
CREATE OR REPLACE FUNCTION update_onboarding_on_integration_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update for Planning Center integrations with active status
  IF NEW.service_name = 'planning_center' AND NEW.status = 'active' THEN
    UPDATE organizations
    SET onboarding_progress = jsonb_set(
      COALESCE(onboarding_progress, '{}'::jsonb),
      '{pco_connected}',
      'true'::jsonb
    )
    WHERE id = NEW.organization_id
      AND COALESCE((onboarding_progress->>'pco_connected')::boolean, false) = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for integration status update
CREATE TRIGGER trigger_update_onboarding_on_integration_created
AFTER INSERT OR UPDATE OF status ON integrations
FOR EACH ROW
WHEN (NEW.service_name = 'planning_center' AND NEW.status = 'active')
EXECUTE FUNCTION update_onboarding_on_integration_created();