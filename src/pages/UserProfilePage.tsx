import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail, Phone, MessageSquare, Edit, User } from "lucide-react";
import { ContactDemographics } from "@/components/contact/ContactDemographics";
import { ContactFlowStatus } from "@/components/contact/ContactFlowStatus";
import { InteractionTimeline } from "@/components/contact/InteractionTimeline";
import { ContactNotes } from "@/components/contact/ContactNotes";
import { PrayerRequestsList } from "@/components/contact/PrayerRequestsList";
import { QuickActionsSidebar } from "@/components/contact/QuickActionsSidebar";
import { useAuth } from "@/hooks/useAuth";

const UserProfilePage = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch comprehensive contact data
  const { data: contactData, isLoading, error } = useQuery({
    queryKey: ["contact-comprehensive", contactId],
    queryFn: async () => {
      if (!contactId) throw new Error("Contact ID is required");

      // Fetch basic contact details
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();

      if (contactError) throw contactError;

      // Fetch contact tags
      const { data: tags } = await supabase
        .from("contact_tags")
        .select("tag")
        .eq("contact_id", contactId);

      // Fetch demographics
      const { data: demographics } = await supabase
        .from("contact_demographics")
        .select("*")
        .eq("contact_id", contactId)
        .maybeSingle();

      // Fetch addresses
      const { data: addresses } = await supabase
        .from("contact_addresses")
        .select("*")
        .eq("contact_id", contactId)
        .order("is_primary", { ascending: false });

      // Fetch family members
      const { data: familyMembers } = await supabase
        .from("contact_family_members")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at");

      // Fetch pipeline involvement with stage counts
      const { data: pipelineContacts } = await supabase
        .from("pipeline_contacts")
        .select(`
          *,
          pipelines!inner(id, name, icon),
          pipeline_stages!inner(id, name, color, stage_order)
        `)
        .eq("contact_id", contactId);

      // Get total stages per pipeline for progress calculation
      const flows = [];
      if (pipelineContacts) {
        for (const pc of pipelineContacts) {
          const { data: allStages } = await supabase
            .from("pipeline_stages")
            .select("stage_order")
            .eq("pipeline_id", pc.pipeline_id)
            .order("stage_order");

          const totalStages = allStages?.length || 1;
          const currentStageOrder = pc.pipeline_stages.stage_order;
          const progressPercentage = (currentStageOrder / totalStages) * 100;

          flows.push({
            pipeline: pc.pipelines,
            currentStage: pc.pipeline_stages,
            totalStages,
            progressPercentage
          });
        }
      }

      // Fetch interactions
      const { data: interactions } = await supabase
        .from("contact_interactions")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      // Fetch notes (simplified without joins for now)
      const { data: notes } = await supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      // Fetch prayer requests (simplified without joins for now)
      const { data: prayerRequests } = await supabase
        .from("contact_prayer_requests")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      return {
        contact,
        tags: tags?.map(t => t.tag) || [],
        demographics,
        addresses: addresses || [],
        familyMembers: familyMembers || [],
        flows,
        interactions: interactions || [],
        notes: notes || [],
        prayerRequests: prayerRequests || []
      };
    },
    enabled: !!contactId,
  });

  // Mutations for adding data
  const addNoteMutation = useMutation({
    mutationFn: async ({ content, noteType, isPrivate }: { content: string; noteType: string; isPrivate: boolean }) => {
      const { error } = await supabase
        .from("contact_notes")
        .insert({
          contact_id: contactId!,
          content,
          note_type: noteType,
          is_private: isPrivate,
          created_by_user_id: user!.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
      toast({ title: "Note added successfully" });
    }
  });

  const addPrayerRequestMutation = useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      const { error } = await supabase
        .from("contact_prayer_requests")
        .insert({
          contact_id: contactId!,
          title,
          description,
          created_by_user_id: user!.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
      toast({ title: "Prayer request added successfully" });
    }
  });

  const markPrayerAnsweredMutation = useMutation({
    mutationFn: async ({ id, answerDescription }: { id: string; answerDescription: string }) => {
      const { error } = await supabase
        .from("contact_prayer_requests")
        .update({
          status: "answered",
          answered_at: new Date().toISOString(),
          answer_description: answerDescription
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
      toast({ title: "Prayer request marked as answered" });
    }
  });

  if (error) {
    console.error("Error fetching contact:", error);
    navigate(-1);
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (!contactData) {
    return (
      <div className="p-6">
        <p>Contact not found</p>
      </div>
    );
  }

  const { contact, tags, demographics, addresses, familyMembers, flows, interactions, notes, prayerRequests } = contactData;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={contact.avatar} alt={contact.name} />
              <AvatarFallback>
                <User className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{contact.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant={contact.status === 'active' ? 'default' : 'secondary'}>
                  {contact.status}
                </Badge>
                {tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Contact Actions */}
        <div className="flex items-center gap-2">
          {contact.phone && (
            <Button variant="outline" size="sm" onClick={() => window.open(`tel:${contact.phone}`)}>
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
          )}
          {contact.email && (
            <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${contact.email}`)}>
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          )}
          {contact.phone && (
            <Button variant="outline" size="sm" onClick={() => window.open(`sms:${contact.phone}`)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Text
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - General Information */}
        <div className="lg:col-span-1 space-y-6">
          <ContactDemographics
            demographics={demographics}
            addresses={addresses}
            familyMembers={familyMembers}
          />
        </div>

        {/* Main Content Area - Flow-Specific Information */}
        <div className="lg:col-span-2 space-y-6">
          <ContactFlowStatus flows={flows} />
          
          <InteractionTimeline
            interactions={interactions}
            onAddInteraction={() => toast({ title: "Add interaction feature coming soon" })}
          />
          
          <ContactNotes
            notes={notes}
            onAddNote={(content, noteType, isPrivate) => 
              addNoteMutation.mutate({ content, noteType, isPrivate })
            }
          />
          
          <PrayerRequestsList
            prayerRequests={prayerRequests}
            onAddPrayerRequest={(title, description) => 
              addPrayerRequestMutation.mutate({ title, description })
            }
            onMarkAnswered={(id, answerDescription) => 
              markPrayerAnsweredMutation.mutate({ id, answerDescription })
            }
          />
        </div>

        {/* Right Sidebar - Quick Actions */}
        <div className="lg:col-span-1">
          <QuickActionsSidebar
            contact={contact}
            onEditContact={() => toast({ title: "Edit contact feature coming soon" })}
            onAddNote={() => toast({ title: "Scroll down to add notes" })}
            onAddInteraction={() => toast({ title: "Add interaction feature coming soon" })}
            onAddPrayerRequest={() => toast({ title: "Scroll down to add prayer requests" })}
            onScheduleFollowUp={() => toast({ title: "Schedule follow-up feature coming soon" })}
          />
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;