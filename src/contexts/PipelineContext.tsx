import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Pipeline } from "@/types/crm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { hostTeamPipeline, pastoralCarePipeline, operationsPipeline, givingHubPipeline } from "@/data/mockData";

interface PipelineContextType {
  pipelines: Record<string, Pipeline>;
  updatePipeline: (pipelineId: string, pipeline: Pipeline) => void;
  createPipeline: (pipeline: Omit<Pipeline, 'id'>) => Promise<string>;
  loading: boolean;
  error: string | null;
}

const PipelineContext = createContext<PipelineContextType | undefined>(undefined);

export const usePipelineContext = () => {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error("usePipelineContext must be used within a PipelineProvider");
  }
  return context;
};

interface PipelineProviderProps {
  children: ReactNode;
}

// Convert database contact format to frontend format
const convertDbContactToFrontend = (dbContact: any, tags: any[]): any => ({
  id: dbContact.id,
  name: dbContact.name,
  email: dbContact.email,
  phone: dbContact.phone,
  avatar: dbContact.avatar,
  notes: dbContact.notes,
  status: dbContact.status,
  date: dbContact.created_at,
  tags: tags.map(t => t.tag),
  assignedTo: dbContact.assigned_to_user_id ? {
    name: "Assigned User", // Would need to fetch actual user info
    avatar: undefined
  } : undefined
});

// Convert database pipeline format to frontend format  
const convertDbPipelineToFrontend = (dbPipeline: any, stages: any[], contacts: any[], contactTags: any[]): Pipeline => ({
  id: dbPipeline.id,
  name: dbPipeline.name,
  icon: dbPipeline.icon,
  stages: stages.map(stage => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    contacts: contacts
      .filter(pc => pc.stage_id === stage.id)
      .map(pc => {
        const contact = pc.contacts;
        const tags = contactTags.filter(ct => ct.contact_id === contact.id);
        return convertDbContactToFrontend(contact, tags);
      })
  }))
});

export const PipelineProvider: React.FC<PipelineProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { organization, loading: profileLoading } = useProfile();
  const [pipelines, setPipelines] = useState<Record<string, Pipeline>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load pipelines from database when user/organization is available
  useEffect(() => {
    if (!user || !organization) {
      setLoading(false);
      return;
    }

    const loadPipelines = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if organization has any pipelines
        const { data: existingPipelines, error: pipelinesError } = await supabase
          .from('pipelines')
          .select('*')
          .eq('organization_id', organization.id);

        if (pipelinesError) throw pipelinesError;

        // If no pipelines exist, create default ones
        if (!existingPipelines || existingPipelines.length === 0) {
          await createDefaultPipelines(organization.id);
          // Reload after creating defaults
          const { data: newPipelines, error: newError } = await supabase
            .from('pipelines')
            .select('*')
            .eq('organization_id', organization.id);
          
          if (newError) throw newError;
          const pipelinesData = await loadPipelineData(newPipelines || []);
          setPipelines(pipelinesData);
        } else {
          const pipelinesData = await loadPipelineData(existingPipelines);
          setPipelines(pipelinesData);
        }
      } catch (err) {
        console.error("Error loading pipelines:", err);
        setError(err instanceof Error ? err.message : "Failed to load pipelines");
        // Fallback to default pipelines on error
        setPipelines({
          "host-team": hostTeamPipeline,
          "pastoral-care": pastoralCarePipeline,
          "operations": operationsPipeline,
          "giving-hub": givingHubPipeline,
        });
      } finally {
        setLoading(false);
      }
    };

    loadPipelines();
  }, [user, organization]);

  const createDefaultPipelines = async (organizationId: string) => {
    const defaultPipelines = [
      { id: "host-team", pipeline: hostTeamPipeline },
      { id: "pastoral-care", pipeline: pastoralCarePipeline },
      { id: "operations", pipeline: operationsPipeline },
      { id: "giving-hub", pipeline: givingHubPipeline }
    ];

    for (const { id, pipeline } of defaultPipelines) {
      // Create pipeline
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
          id,
          name: pipeline.name,
          icon: pipeline.icon,
          organization_id: organizationId
        })
        .select()
        .single();

      if (pipelineError) throw pipelineError;

      // Create stages
      for (let i = 0; i < pipeline.stages.length; i++) {
        const stage = pipeline.stages[i];
        const { data: stageData, error: stageError } = await supabase
          .from('pipeline_stages')
          .insert({
            id: stage.id,
            pipeline_id: pipelineData.id,
            name: stage.name,
            color: stage.color,
            stage_order: i
          })
          .select()
          .single();

        if (stageError) throw stageError;

        // Create contacts for this stage
        for (let j = 0; j < stage.contacts.length; j++) {
          const contact = stage.contacts[j];
          const { data: contactData, error: contactError } = await supabase
            .from('contacts')
            .insert({
              id: contact.id,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              avatar: contact.avatar,
              notes: contact.notes,
              status: contact.status,
              organization_id: organizationId
            })
            .select()
            .single();

          if (contactError) throw contactError;

          // Create contact tags
          for (const tag of contact.tags) {
            await supabase
              .from('contact_tags')
              .insert({
                contact_id: contactData.id,
                tag
              });
          }

          // Link contact to pipeline stage
          await supabase
            .from('pipeline_contacts')
            .insert({
              pipeline_id: pipelineData.id,
              stage_id: stageData.id,
              contact_id: contactData.id,
              stage_order: j
            });
        }
      }
    }
  };

  const loadPipelineData = async (pipelinesList: any[]): Promise<Record<string, Pipeline>> => {
    const pipelinesData: Record<string, Pipeline> = {};

    for (const pipeline of pipelinesList) {
      // Load stages
      const { data: stages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipeline.id)
        .order('stage_order');

      if (stagesError) throw stagesError;

      // Load pipeline contacts with contact details
      const { data: pipelineContacts, error: contactsError } = await supabase
        .from('pipeline_contacts')
        .select(`
          *,
          contacts (*)
        `)
        .eq('pipeline_id', pipeline.id);

      if (contactsError) throw contactsError;

      // Load all contact tags for this pipeline
      const contactIds = pipelineContacts?.map(pc => pc.contact_id) || [];
      const { data: contactTags, error: tagsError } = await supabase
        .from('contact_tags')
        .select('*')
        .in('contact_id', contactIds);

      if (tagsError) throw tagsError;

      const convertedPipeline = convertDbPipelineToFrontend(
        pipeline,
        stages || [],
        pipelineContacts || [],
        contactTags || []
      );

      pipelinesData[pipeline.id] = convertedPipeline;
    }

    return pipelinesData;
  };

  const updatePipeline = async (pipelineId: string, pipeline: Pipeline) => {
    if (!organization) return;

    try {
      // Update pipeline in database
      const { error: pipelineError } = await supabase
        .from('pipelines')
        .update({
          name: pipeline.name,
          icon: pipeline.icon
        })
        .eq('id', pipelineId)
        .eq('organization_id', organization.id);

      if (pipelineError) throw pipelineError;

      // Update stages and contacts
      for (let i = 0; i < pipeline.stages.length; i++) {
        const stage = pipeline.stages[i];
        
        // Update stage
        const { error: stageError } = await supabase
          .from('pipeline_stages')
          .update({
            name: stage.name,
            color: stage.color,
            stage_order: i
          })
          .eq('id', stage.id)
          .eq('pipeline_id', pipelineId);

        if (stageError) throw stageError;

        // Update pipeline_contacts for this stage
        for (let j = 0; j < stage.contacts.length; j++) {
          const contact = stage.contacts[j];
          
          // Update the pipeline_contacts entry
          const { error: pcError } = await supabase
            .from('pipeline_contacts')
            .update({
              stage_id: stage.id,
              stage_order: j
            })
            .eq('contact_id', contact.id)
            .eq('pipeline_id', pipelineId);

          if (pcError) throw pcError;
        }
      }

      // Update local state
      setPipelines(prev => ({
        ...prev,
        [pipelineId]: pipeline
      }));

    } catch (err) {
      console.error("Error updating pipeline:", err);
      setError(err instanceof Error ? err.message : "Failed to update pipeline");
    }
  };

  const createPipeline = async (pipeline: Omit<Pipeline, 'id'>): Promise<string> => {
    console.log("createPipeline called with:", pipeline);
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
      const pipelineId = `custom-${Date.now()}`;
      console.log("Generated pipeline ID:", pipelineId);
      
      // Create pipeline in database
      console.log("Creating pipeline in database...");
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
          id: pipelineId,
          name: pipeline.name,
          icon: pipeline.icon,
          organization_id: organization.id
        })
        .select()
        .single();

      console.log("Pipeline creation result:", { pipelineData, pipelineError });
      if (pipelineError) {
        console.error("Pipeline creation error:", pipelineError);
        throw pipelineError;
      }

      // Create stages
      console.log("Creating stages...");
      for (let i = 0; i < pipeline.stages.length; i++) {
        const stage = pipeline.stages[i];
        const stageId = `${pipelineId}-stage-${i + 1}`;
        console.log(`Creating stage ${i + 1}:`, { stageId, stage });
        
        const { data: stageData, error: stageError } = await supabase
          .from('pipeline_stages')
          .insert({
            id: stageId,
            pipeline_id: pipelineData.id,
            name: stage.name,
            color: stage.color,
            stage_order: i
          })
          .select()
          .single();

        console.log("Stage creation result:", { stageData, stageError });
        if (stageError) {
          console.error("Stage creation error:", stageError);
          throw stageError;
        }
      }

      // Create the pipeline object with generated IDs
      const newPipeline: Pipeline = {
        ...pipeline,
        id: pipelineId,
        stages: pipeline.stages.map((stage, i) => ({
          ...stage,
          id: `${pipelineId}-stage-${i + 1}`,
          contacts: []
        }))
      };

      console.log("Created pipeline object:", newPipeline);

      // Update local state
      setPipelines(prev => ({
        ...prev,
        [pipelineId]: newPipeline
      }));

      console.log("Pipeline created successfully, returning ID:", pipelineId);
      return pipelineId;

    } catch (err) {
      console.error("Error creating pipeline:", err);
      setError(err instanceof Error ? err.message : "Failed to create pipeline");
      throw err;
    }
  };

  return (
    <PipelineContext.Provider value={{ pipelines, updatePipeline, createPipeline, loading, error }}>
      {children}
    </PipelineContext.Provider>
  );
};