import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Flow } from "@/types/crm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

interface FlowContextType {
  flows: Record<string, Flow>;
  updateFlow: (flowId: string, flow: Flow) => void;
  createFlow: (flow: Omit<Flow, 'id'>) => Promise<string>;
  deleteFlow: (flowId: string) => Promise<void>;
  refreshFlows: () => Promise<void>;
  reorderFlows: (flows: Flow[]) => Promise<void>;
  duplicateFlow: (flowId: string) => Promise<string>;
  loading: boolean;
  error: string | null;
}

const FlowContext = createContext<FlowContextType | undefined>(undefined);

export const useFlowContext = () => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error("useFlowContext must be used within a FlowProvider");
  }
  return context;
};

interface FlowProviderProps {
  children: ReactNode;
}

// Convert database contact format to frontend format
const convertDbContactToFrontend = (dbContact: any, tags: any[], assignedProfile?: any, pipelineContactData?: any, campusMap?: Map<string, string>): any => ({
  id: dbContact.id,
  name: dbContact.name,
  email: dbContact.email,
  phone: dbContact.phone,
  avatar: dbContact.avatar,
  notes: dbContact.notes,
  status: dbContact.status,
  date: dbContact.created_at,
  tags: tags.map(t => t.tag),
  assignedTo: assignedProfile ? {
    name: assignedProfile.full_name || assignedProfile.email || "Unknown User",
    avatar: assignedProfile.avatar_url
  } : undefined,
  stageEnteredAt: pipelineContactData?.stage_entered_at,
  completedEndAt: pipelineContactData?.completed_end_at,
  campusId: dbContact.campus_id || undefined,
  campusName: dbContact.campus_id && campusMap ? campusMap.get(dbContact.campus_id) : undefined,
});

// Convert database pipeline format to frontend format (keeping database names for data compatibility)
const convertDbPipelineToFrontend = (dbPipeline: any, stages: any[], contacts: any[], contactTags: any[], profiles: any[], campusMap?: Map<string, string>): Flow => {
  const safeStages = (stages || []).filter(Boolean);
  const safeContacts = (contacts || []).filter(Boolean);
  const safeTags = (contactTags || []).filter(Boolean);
  const safeProfiles = (profiles || []).filter(Boolean);

  return {
    id: dbPipeline.id,
    name: dbPipeline.name,
    description: dbPipeline.description,
    icon: dbPipeline.icon,
    flow_order: dbPipeline.flow_order || 0,
    flow_type: dbPipeline.flow_type || 'linear',
    cycle_days: dbPipeline.cycle_days,
    stages: safeStages
      .filter(stage => stage && stage.id)
      .map(stage => {
        const defaultAssigneeProfile = stage.default_assignee_user_id
          ? safeProfiles.find(p => p && p.user_id === stage.default_assignee_user_id)
          : undefined;
        
        return {
          id: stage.id,
          name: stage.name,
          color: stage.color,
          is_start_step: stage.is_start_step,
          is_end_step: stage.is_end_step,
          description: stage.description,
          default_assignee_user_id: stage.default_assignee_user_id,
          defaultAssignee: defaultAssigneeProfile ? {
            name: defaultAssigneeProfile.full_name || defaultAssigneeProfile.email || "Unknown User",
            avatar: defaultAssigneeProfile.avatar_url
          } : undefined,
          contacts: safeContacts
            .filter(pc => pc && pc.stage_id && pc.stage_id === stage.id && pc.contacts)
            .map(pc => {
              const contact = pc.contacts;
              const tags = safeTags.filter(ct => ct && ct.contact_id && contact && ct.contact_id === contact.id);
              const assignedProfile = pc.assigned_to_user_id 
                ? safeProfiles.find(p => p && p.user_id === pc.assigned_to_user_id)
                : undefined;
              return convertDbContactToFrontend(contact, tags, assignedProfile, pc, campusMap);
            })
        };
      })
  };
};

export const FlowProvider: React.FC<FlowProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { organization, loading: profileLoading } = useProfile();
  const [flows, setFlows] = useState<Record<string, Flow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load flows from database when user is available
  useEffect(() => {
    // Don't load if still loading profile, no user, or no organization
    if (profileLoading || !user || !organization) {
      return;
    }

    const loadFlows = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Loading flows for user:", user.id);
        console.log("Active organization:", organization?.id || "none yet");

        // Check if user is org admin/owner
        const { data: membershipData } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', organization.id)
          .single();

        const isOrgAdmin = membershipData?.role === 'owner' || membershipData?.role === 'admin';

        let existingPipelines;
        if (isOrgAdmin) {
          // Admins see ALL flows in their organization
          const { data: allPipelines, error: pipelinesError } = await supabase
            .from('pipelines')
            .select('*')
            .eq('organization_id', organization.id)
            .order('flow_order');
          
          existingPipelines = allPipelines || [];
          
          if (pipelinesError) {
            console.error("Error fetching pipelines:", pipelinesError);
            throw pipelinesError;
          }
        } else {
          // Regular members only see flows they're team members of
          const { data: teamMemberships, error: pipelinesError } = await supabase
            .from('pipeline_team_members')
            .select('pipeline_id, pipelines(*)')
            .eq('user_id', user.id);

          existingPipelines = teamMemberships
            ?.map((tm: any) => tm.pipelines)
            .filter(Boolean)
            .sort((a: any, b: any) => (a.flow_order || 0) - (b.flow_order || 0)) || [];
          
          if (pipelinesError) {
            console.error("Error fetching pipelines:", pipelinesError);
            throw pipelinesError;
          }
        }

        console.log("Found existing pipelines:", existingPipelines?.length || 0);

        if (existingPipelines && existingPipelines.length > 0) {
          console.log("Loading existing flows...");
          const flowsData = await loadFlowData(existingPipelines);
          setFlows(flowsData);
          console.log("Existing flows loaded");
        } else {
          // No pipelines yet - they should be created by the database trigger
          console.log("No pipelines found");
          setFlows({});
        }
      } catch (err) {
        console.error("Error loading flows:", err);
        setError(err instanceof Error ? err.message : "Failed to load flows");
        setFlows({});
      } finally {
        setLoading(false);
      }
    };

    loadFlows();
  }, [user, organization, profileLoading]);


  const refreshFlows = async () => {
    if (!user || profileLoading || !organization) {
      return;
    }

    try {
      setError(null);
      console.log("Refreshing flows...");
      
      if (!organization) {
        console.error("No organization found for user");
        return;
      }

      // Check if user is org admin/owner
      const { data: membershipData } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .single();

      const isOrgAdmin = membershipData?.role === 'owner' || membershipData?.role === 'admin';

      let existingPipelines;
      if (isOrgAdmin) {
        // Admins see ALL flows in their organization
        const { data: allPipelines, error: pipelinesError } = await supabase
          .from('pipelines')
          .select('*')
          .eq('organization_id', organization.id)
          .order('flow_order');
        
        existingPipelines = allPipelines || [];
        
        if (pipelinesError) {
          console.error("Error fetching pipelines:", pipelinesError);
          throw pipelinesError;
        }
      } else {
        // Regular members only see flows they're team members of
        const { data: teamMemberships, error: pipelinesError } = await supabase
          .from('pipeline_team_members')
          .select('pipeline_id, pipelines(*)')
          .eq('user_id', user.id);

        existingPipelines = teamMemberships
          ?.map((tm: any) => tm.pipelines)
          .filter(Boolean)
          .sort((a: any, b: any) => (a.flow_order || 0) - (b.flow_order || 0)) || [];
        
        if (pipelinesError) {
          console.error("Error fetching pipelines:", pipelinesError);
          throw pipelinesError;
        }
      }


      if (existingPipelines && existingPipelines.length > 0) {
        const flowsData = await loadFlowData(existingPipelines);
        setFlows(flowsData);
        console.log("Flows refreshed successfully");
      } else {
        setFlows({});
        console.log("No flows found during refresh");
      }
    } catch (err) {
      console.error("Error refreshing flows:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh flows");
    }
  };

  // Helper function to chunk arrays for batched queries
  const chunk = <T,>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const loadFlowData = async (pipelinesList: any[]): Promise<Record<string, Flow>> => {
    if (!pipelinesList || pipelinesList.length === 0) {
      return {};
    }

    console.log(`[FlowContext] Loading data for ${pipelinesList.length} pipelines`);

    const flowsData: Record<string, Flow> = {};
    const pipelineIds = pipelinesList.map(p => p.id);

    // PHASE 1: Parallelize all queries - fetch ALL data for ALL pipelines at once
    const [
      { data: allStages, error: stagesError },
      { data: allFlowContacts, error: contactsError }
    ] = await Promise.all([
      // Single query for ALL stages across ALL pipelines (including default assignee info)
      supabase
        .from('pipeline_stages')
        .select('*')
        .in('pipeline_id', pipelineIds)
        .order('stage_order'),
      
      // Single query for ALL contacts across ALL pipelines (include completed for toggle)
      supabase
        .from('pipeline_contacts')
        .select('*, contacts(*)')
        .in('pipeline_id', pipelineIds)
    ]);

    if (stagesError) throw stagesError;
    if (contactsError) throw contactsError;

    // Get all unique contact IDs, user IDs, and default assignee IDs
    const allContactIds = [...new Set(allFlowContacts?.map(pc => pc.contact_id).filter(Boolean) || [])];
    const contactAssigneeIds = [...new Set(allFlowContacts?.map(pc => pc.assigned_to_user_id).filter(Boolean) || [])];
    const stageAssigneeIds = [...new Set(allStages?.map(s => s.default_assignee_user_id).filter(Boolean) || [])];
    const allUserIds = [...new Set([...contactAssigneeIds, ...stageAssigneeIds])];

    console.log(`[FlowContext] Found ${allContactIds.length} unique contacts, ${allUserIds.length} unique users`);

    // Fetch tags and profiles using chunked queries to avoid 400 errors with large datasets
    let allContactTags: any[] = [];
    let allProfiles: any[] = [];

    try {
      // Fetch contact tags in chunks of 150
      if (allContactIds.length > 0) {
        const contactIdChunks = chunk(allContactIds, 150);
        console.log(`[FlowContext] Fetching tags in ${contactIdChunks.length} chunks`);
        
        const tagChunkResults = await Promise.all(
          contactIdChunks.map(async (chunkIds) => {
            const { data, error } = await supabase
              .from('contact_tags')
              .select('*')
              .in('contact_id', chunkIds);
            
            if (error) {
              console.warn('[FlowContext] Error fetching tag chunk:', error);
              return [];
            }
            return data || [];
          })
        );
        
        allContactTags = tagChunkResults.flat();
        console.log(`[FlowContext] Loaded ${allContactTags.length} tags`);
      }
    } catch (err) {
      console.error('[FlowContext] Failed to load contact tags:', err);
      allContactTags = [];
    }

    try {
      // Fetch profiles in chunks of 200
      if (allUserIds.length > 0) {
        const userIdChunks = chunk(allUserIds, 200);
        console.log(`[FlowContext] Fetching profiles in ${userIdChunks.length} chunks`);
        
        const profileChunkResults = await Promise.all(
          userIdChunks.map(async (chunkIds) => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .in('user_id', chunkIds);
            
            if (error) {
              console.warn('[FlowContext] Error fetching profile chunk:', error);
              return [];
            }
            return data || [];
          })
        );
        
        allProfiles = profileChunkResults.flat();
        console.log(`[FlowContext] Loaded ${allProfiles.length} profiles`);
      }
    } catch (err) {
      console.error('[FlowContext] Failed to load profiles:', err);
      allProfiles = [];
    }

    // Fetch campus names for contacts that have campus_id
    const campusMap = new Map<string, string>();
    const allCampusIds = [...new Set(
      allFlowContacts
        ?.map(pc => (pc.contacts as any)?.campus_id)
        .filter(Boolean) || []
    )];

    if (allCampusIds.length > 0) {
      try {
        const { data: campuses } = await supabase
          .from('campuses')
          .select('id, name')
          .in('id', allCampusIds);
        campuses?.forEach(c => campusMap.set(c.id, c.name));
      } catch (err) {
        console.warn('[FlowContext] Failed to load campuses:', err);
      }
    }

    // Group data by pipeline_id in memory
    for (const pipeline of pipelinesList) {
      const pipelineStages = allStages?.filter(s => s.pipeline_id === pipeline.id) || [];
      const pipelineContacts = allFlowContacts?.filter(pc => pc.pipeline_id === pipeline.id) || [];
      
      const convertedFlow = convertDbPipelineToFrontend(
        pipeline,
        pipelineStages,
        pipelineContacts,
        allContactTags,
        allProfiles,
        campusMap
      );

      flowsData[pipeline.id] = convertedFlow;
    }

    console.log(`[FlowContext] Loaded ${Object.keys(flowsData).length} flows successfully`);
    return flowsData;
  };

  // Listen for events to refresh flow data
  useEffect(() => {
    const refresh = (label: string) => {
      console.log(`${label} event, refreshing flows...`);
      refreshFlows();
    };

    const onSync = () => refresh('Sync completed');
    const onAssignment = () => refresh('Assignment updated');
    const onFlowsCreated = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('FlowContext: Received flows-created event', customEvent.detail);
      toast.success("Welcome! We've set up 7 default flows to get you started 🎉", {
        duration: 5000,
      });
      refresh('Default flows created');
    };

    window.addEventListener('pco-sync-complete', onSync);
    window.addEventListener('flow-assignment-updated', onAssignment);
    window.addEventListener('flows-created', onFlowsCreated);

    return () => {
      window.removeEventListener('pco-sync-complete', onSync);
      window.removeEventListener('flow-assignment-updated', onAssignment);
      window.removeEventListener('flows-created', onFlowsCreated);
    };
  }, [user, profileLoading]);

  const updateFlow = async (flowId: string, flow: Flow) => {
    if (!organization) return;

    // Store previous flow for potential rollback
    const previousFlow = flows[flowId];

    // Optimistic update - update UI immediately
    setFlows(prev => ({
      ...prev,
      [flowId]: flow
    }));

    // Update database in background
    try {
      // Update flow in database (stored as pipeline)
      const { error: flowError } = await supabase
        .from('pipelines')
        .update({
          name: flow.name,
          description: flow.description,
          icon: flow.icon
        })
        .eq('id', flowId)
        .eq('organization_id', organization.id);

      if (flowError) throw flowError;

      // Update/Create stages and contacts
      for (let i = 0; i < flow.stages.length; i++) {
        const stage = flow.stages[i];
        
        let stageId = stage.id;
        
        if (!stage.id || stage.id === "") {
          // This is a new stage - insert it
          const { data: newStage, error: insertError } = await supabase
            .from('pipeline_stages')
            .insert({
              pipeline_id: flowId,
              name: stage.name,
              color: stage.color,
              stage_order: i,
              default_assignee_user_id: stage.default_assignee_user_id || null
            })
            .select()
            .single();
            
          if (insertError) throw insertError;
          stageId = newStage.id;
        } else {
          // This is an existing stage - update it
          const { error: stageError } = await supabase
            .from('pipeline_stages')
            .update({
              name: stage.name,
              color: stage.color,
              stage_order: i,
              default_assignee_user_id: stage.default_assignee_user_id || null
            })
            .eq('id', stage.id)
            .eq('pipeline_id', flowId);

          if (stageError) throw stageError;
        }

        // Update pipeline_contacts for this stage
        for (let j = 0; j < stage.contacts.length; j++) {
          const contact = stage.contacts[j];
          
          // Check if this stage is an end step
          const isEndStep = stage.is_end_step === true;
          
          // Check if destination stage has default assignee
          const destinationStage = flow.stages.find(s => s.id === stageId);
          
          // Prepare update data
          const updateData: any = {
            stage_id: stageId,
            stage_order: j
          };
          
          // Auto-assign if stage has default assignee
          if (destinationStage?.default_assignee_user_id) {
            updateData.assigned_to_user_id = destinationStage.default_assignee_user_id;
          }
          
          // Update stage_entered_at if stage changed
          const previousContact = previousFlow?.stages
            .flatMap(s => s.contacts)
            .find(c => c.id === contact.id);
          const previousStageId = previousFlow?.stages.find(s => 
            s.contacts.some(c => c.id === contact.id)
          )?.id;
          
          if (previousStageId && previousStageId !== stageId) {
            updateData.stage_entered_at = new Date().toISOString();
          }
          
          // If moving to end step, mark as completed
          if (isEndStep) {
            updateData.completed_end_at = new Date().toISOString();
            
            // Record the completion in interactions
            await supabase.from('contact_interactions').insert({
              contact_id: contact.id,
              interaction_type: 'flow_completed',
              subject: `Completed ${flow.name}`,
              details: `Contact reached the end step: ${stage.name}`,
              created_by_user_id: user!.id,
              pipeline_id: flowId,
              stage_id: stageId,
              completed_at: new Date().toISOString()
            });
            
            // Check if flow has a completion moment type and create moment
            const { data: pipelineData, error: pipelineFetchError } = await supabase
              .from('pipelines')
              .select('completion_moment_type_id')
              .eq('id', flowId)
              .single();
            
            if (pipelineFetchError) {
              console.error('Error fetching pipeline for moment creation:', pipelineFetchError);
            }
            
            console.log(`[FlowMoment] Pipeline ${flowId} completion_moment_type_id:`, pipelineData?.completion_moment_type_id);
            
            if (pipelineData?.completion_moment_type_id) {
              // Check if contact already has this moment
              const { data: existingMoment, error: existingMomentError } = await supabase
                .from('flow_moments')
                .select('id')
                .eq('contact_id', contact.id)
                .eq('flow_moment_type_id', pipelineData.completion_moment_type_id)
                .maybeSingle();
              
              if (existingMomentError) {
                console.error('Error checking existing moment:', existingMomentError);
              }
              
              console.log(`[FlowMoment] Existing moment for contact ${contact.id}:`, existingMoment);
              
              if (!existingMoment) {
                // Create the flow moment
                const { error: momentInsertError } = await supabase.from('flow_moments').insert({
                  contact_id: contact.id,
                  flow_moment_type_id: pipelineData.completion_moment_type_id,
                  source_system: 'flow',
                  source_reference: `pipeline:${flowId}:${stageId}`,
                  occurred_at: new Date().toISOString(),
                  metadata: {
                    pipeline_name: flow.name,
                    stage_name: stage.name
                  },
                  created_by_user_id: user!.id
                });
                
                if (momentInsertError) {
                  console.error('Error creating completion moment:', momentInsertError);
                  toast.error('Failed to record completion moment');
                } else {
                  console.log(`[FlowMoment] Created completion moment for contact ${contact.id} in flow ${flow.name}`);
                }
              } else {
                console.log(`[FlowMoment] Contact ${contact.id} already has this moment type`);
              }
            } else {
              console.log(`[FlowMoment] No completion moment type configured for flow ${flowId}`);
            }
          }
          
          // Update the pipeline_contacts entry
          const { error: pcError } = await supabase
            .from('pipeline_contacts')
            .update(updateData)
            .eq('contact_id', contact.id)
            .eq('pipeline_id', flowId);

          if (pcError) throw pcError;
        }
      }

    } catch (err) {
      console.error("Error updating flow:", err);
      setError(err instanceof Error ? err.message : "Failed to update flow");
      
      // Revert optimistic update
      if (previousFlow) {
        setFlows(prev => ({
          ...prev,
          [flowId]: previousFlow
        }));
      }
      
      // Show error to user
      toast.error("Failed to save changes. Reverting...");
      
      // Optionally refetch to ensure consistency
      await refreshFlows();
    }
  };

  const createFlow = async (flow: Omit<Flow, 'id'>): Promise<string> => {
    console.log("createFlow called with:", flow);
    console.log("Organization:", organization);
    console.log("Profile loading:", profileLoading);
    
    if (profileLoading) {
      throw new Error("Profile is still loading, please wait and try again");
    }
    
    if (!organization) {
      console.error("No organization available");
      throw new Error("No organization available - please ensure you're properly authenticated and associated with an organization");
    }

    try {
      // Generate a proper UUID for the flow
      const flowId = crypto.randomUUID();
      console.log("Generated flow ID:", flowId);
      
      // Create flow in database (stored as pipeline)
      console.log("Creating flow in database...");
      const { error: flowError } = await supabase
        .from('pipelines')
        .insert({
          id: flowId,
          name: flow.name,
          icon: flow.icon,
          organization_id: organization.id,
          flow_type: flow.flow_type || 'linear',
          cycle_days: flow.cycle_days || null,
        });

      console.log("Flow creation result:", { flowError });
      if (flowError) {
        console.error("Flow creation error:", flowError);
        throw flowError;
      }

      // Add current user as lead (flow owner) - use upsert to handle duplicate key issues
      const { error: teamMemberError } = await supabase
        .from('pipeline_team_members')
        .upsert({
          pipeline_id: flowId,
          user_id: user!.id,
          role: 'lead'
        }, {
          onConflict: 'pipeline_id,user_id'
        });

      if (teamMemberError) {
        console.error("Error adding team member:", teamMemberError);
        // Continue even if this fails as the trigger might have already added it
      }

      // Create stages
      console.log("Creating stages...");
      const createdStages: any[] = [];
      
      for (let i = 0; i < flow.stages.length; i++) {
        const stage = flow.stages[i];
        const stageId = crypto.randomUUID();
        console.log(`Creating stage ${i + 1}:`, { stageId, stage });
        
        const { error: stageError } = await supabase
          .from('pipeline_stages')
          .insert({
            id: stageId,
            pipeline_id: flowId,
            name: stage.name,
            color: stage.color,
            stage_order: i,
            is_start_step: (stage as any).isStartStep || false,
            is_end_step: (stage as any).isEndStep || false
          });
        
        const stageData = {
          id: stageId,
          name: stage.name,
          color: stage.color,
          stage_order: i,
          is_start_step: (stage as any).isStartStep || false,
          is_end_step: (stage as any).isEndStep || false
        };

        console.log("Stage creation result:", { stageData, stageError });
        if (stageError) {
          console.error("Stage creation error:", stageError);
          throw stageError;
        }
        
        createdStages.push(stageData);
      }

      // Create the flow object with actual database IDs
      const newFlow: Flow = {
        ...flow,
        id: flowId,
        stages: createdStages.map(stage => ({
          id: stage.id,
          name: stage.name,
          color: stage.color,
          contacts: []
        }))
      };

      console.log("Created flow object:", newFlow);

      // Update local state
      setFlows(prev => ({
        ...prev,
        [flowId]: newFlow
      }));

      console.log("Flow created successfully, returning ID:", flowId);
      return flowId;

    } catch (err) {
      console.error("Error creating flow:", err);
      setError(err instanceof Error ? err.message : "Failed to create flow");
      throw err;
    }
  };

  const deleteFlow = async (flowId: string): Promise<void> => {
    if (!organization) {
      throw new Error("No organization available");
    }

    try {
      // Delete from database using supabase (stored as pipeline)
      const { error } = await supabase
        .from('pipelines')
        .delete()
        .eq('id', flowId)
        .eq('organization_id', organization.id);

      if (error) throw error;

      // Update local state by removing the deleted flow
      setFlows(prev => {
        const updated = { ...prev };
        delete updated[flowId];
        return updated;
      });

    } catch (err) {
      console.error("Error deleting flow:", err);
      setError(err instanceof Error ? err.message : "Failed to delete flow");
      throw err;
    }
  };

  const reorderFlows = async (reorderedFlows: Flow[]): Promise<void> => {
    if (!organization) {
      throw new Error("No organization available");
    }

    try {
      // Update flow_order in database for each flow
      const updates = reorderedFlows.map((flow, index) => 
        supabase
          .from('pipelines')
          .update({ flow_order: index })
          .eq('id', flow.id)
          .eq('organization_id', organization.id)
      );

      await Promise.all(updates);

      // Update local state
      setFlows(prev => {
        const updated = { ...prev };
        reorderedFlows.forEach((flow) => {
          if (updated[flow.id]) {
            updated[flow.id] = { ...updated[flow.id], flow_order: flow.flow_order };
          }
        });
        return updated;
      });

    } catch (err) {
      console.error("Error reordering flows:", err);
      setError(err instanceof Error ? err.message : "Failed to reorder flows");
      throw err;
    }
  };

  const duplicateFlow = async (sourceFlowId: string): Promise<string> => {
    if (!user?.id || !organization) {
      throw new Error("User or organization context missing");
    }

    try {
      // Fetch source flow with stages
      const { data: sourceFlow, error: flowError } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)')
        .eq('id', sourceFlowId)
        .single();

      if (flowError || !sourceFlow) {
        throw new Error("Source flow not found");
      }

      // Create new flow
      const newFlowId = crypto.randomUUID();
      const { error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
          id: newFlowId,
          organization_id: organization.id,
          name: `${sourceFlow.name} (Copy)`,
          description: sourceFlow.description,
          icon: sourceFlow.icon,
          flow_type: sourceFlow.flow_type,
          cycle_days: sourceFlow.cycle_days,
          flow_order: Object.keys(flows).length
        });

      if (pipelineError) throw pipelineError;

      // Add current user as lead FIRST (before creating stages with assignees)
      const { error: teamError } = await supabase
        .from('pipeline_team_members')
        .upsert({
          pipeline_id: newFlowId,
          user_id: user.id,
          role: 'lead'
        }, {
          onConflict: 'pipeline_id,user_id'
        });

      if (teamError) {
        console.error("Error adding team member:", teamError);
      }

      // Create stages - clear default_assignee_user_id since team isn't copied
      if (sourceFlow.pipeline_stages && sourceFlow.pipeline_stages.length > 0) {
        const newStages = sourceFlow.pipeline_stages.map((stage: any) => ({
          id: crypto.randomUUID(),
          pipeline_id: newFlowId,
          name: stage.name,
          color: stage.color,
          stage_order: stage.stage_order,
          is_start_step: stage.is_start_step,
          is_end_step: stage.is_end_step,
          description: stage.description ?? null,
          default_assignee_user_id: null  // Clear assignees - team isn't copied
        }));

        const { error: stagesError } = await supabase
          .from('pipeline_stages')
          .insert(newStages);

        if (stagesError) throw stagesError;
      }

      await refreshFlows();
      toast.success("Flow duplicated successfully! 🎉");
      return newFlowId;
    } catch (err) {
      console.error('Error duplicating flow:', err);
      toast.error("Failed to duplicate flow");
      throw err;
    }
  };

  return (
    <FlowContext.Provider value={{ flows, updateFlow, createFlow, deleteFlow, refreshFlows, reorderFlows, duplicateFlow, loading, error }}>
      {children}
    </FlowContext.Provider>
  );
};
