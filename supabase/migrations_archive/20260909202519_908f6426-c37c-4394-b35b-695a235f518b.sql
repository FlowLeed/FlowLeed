DELETE FROM public.pco_moment_mappings WHERE organization_id = '3fae9226-c555-4a18-9ebe-a5c583f6406f';

INSERT INTO public.pco_moment_mappings (organization_id, integration_id, pco_source_type, pco_source_identifier, pco_source_label, pco_tab_name, flow_moment_type_id, trigger_condition, rule_combinator, condition_group, is_active)
VALUES
-- Baptism
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','155882','Date Baptized','Baptism Orientation','069ab802-15b0-4af5-a4c9-58825610ac13','{"operator":"is_not_empty","value":null}','AND',0,true),
-- Dream Team / Serving
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','345184','Team','Joined the Team','0889d074-4ab8-42b7-af98-e02ebfef97be','{"operator":"is_not_empty","value":null}','AND',0,true),
-- Freedom (either conference date or year)
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','894380','Conference Date','FREEDOM','c4586e66-e8f2-43a5-9c67-d753871ce86c','{"operator":"is_not_empty","value":null}','OR',0,true),
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','894373','YEAR','FREEDOM','c4586e66-e8f2-43a5-9c67-d753871ce86c','{"operator":"is_not_empty","value":null}','OR',0,true),
-- Fresh Start / Recommitment (either decision or date)
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','613864','I have made a decision:','Fresh Start','9d3259f8-be29-402e-9488-b849d9e0cd72','{"operator":"is_not_empty","value":null}','OR',0,true),
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','613865','Fresh Start Date','Fresh Start','9d3259f8-be29-402e-9488-b849d9e0cd72','{"operator":"is_not_empty","value":null}','OR',0,true),
-- Group Leader (approved)
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','510223','Approved','Group Leadership Track','7e76fc67-61db-4efe-80a0-4d319642b569','{"operator":"is_truthy","value":null}','AND',0,true),
-- Group Leader Ready (baptized + partner + serving)
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','155882','Date Baptized','Baptism Orientation','0a7379c0-e27d-427d-b15b-0cb2a562dfe1','{"operator":"is_not_empty","value":null}','AND',0,true),
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','723432','Partner Level','Stewardship','0a7379c0-e27d-427d-b15b-0cb2a562dfe1','{"operator":"is_not_empty","value":null}','AND',0,true),
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','345184','Team','Joined the Team','0a7379c0-e27d-427d-b15b-0cb2a562dfe1','{"operator":"is_not_empty","value":null}','AND',0,true),
-- Join
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','470892','Joined the Church','JOIN ','db1db6f0-0f50-4edc-9d8f-7d7103d94ec1','{"operator":"is_truthy","value":null}','AND',0,true),
-- Welcome Party Attended
('3fae9226-c555-4a18-9ebe-a5c583f6406f','64c52a88-2259-4c48-8b75-56651d63a54b','custom_tab_field','722018','Attended Welcome Party','Welcome Party ','7f50d9f9-192c-4bc7-baf0-08630e2d7d4c','{"operator":"is_not_empty","value":null}','AND',0,true);