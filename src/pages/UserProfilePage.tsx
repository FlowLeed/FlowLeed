import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail, Phone, MessageSquare, Edit, User, UserCheck, Workflow, Plus, Tags, Activity, Calendar, Flame, Clock, Building2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemberOnboarding } from "@/hooks/useMemberOnboarding";
import { cn } from "@/lib/utils";

import { ContactFlowStatus } from "@/components/contact/ContactFlowStatus";
import { InteractionTimeline } from "@/components/contact/InteractionTimeline";
import { ContactNotes } from "@/components/contact/ContactNotes";
import { PrayerRequestsList } from "@/components/contact/PrayerRequestsList";
import { QuickActionsBar } from "@/components/contact/QuickActionsBar";
import { AISuggestions } from "@/components/contact/AISuggestions";
import { ContactFormDialog } from "@/components/crm/ContactFormDialog";
import { TagManager } from "@/components/contact/TagManager";
import { FlowMomentsCard } from "@/components/contact/FlowMomentsCard";
import { PcoCustomFieldsCard } from "@/components/contact/PcoCustomFieldsCard";
import { ContactCheckinsCard } from "@/components/contact/ContactCheckinsCard";
import { ContactGroupsCard } from "@/components/contact/ContactGroupsCard";
import { EngagementBadge } from "@/components/contact/EngagementBadge";
import { useEngagementScore } from "@/hooks/useCheckinData";

import { ContactStatus } from "@/types/crm";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTagSuggestions } from "@/hooks/useContactTags";
import { useProfile } from "@/hooks/useProfile";
import { useTwilioIntegration } from "@/hooks/useTwilioIntegration";
import { useCalls, CallRecord } from "@/hooks/useCalls";
import { CallStatusDialog } from "@/components/calls/CallStatusDialog";

const getInitials = (name?: string | null) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return "U";
};

const UserProfilePage = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const [searchParams] = useSearchParams();
  const pipelineId = searchParams.get('pipelineId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useProfile();
  const queryClient = useQueryClient();
  const { shouldUseTwilio } = useTwilioIntegration();
  const { initiateCall, setActiveCallId } = useCalls();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [assignedUser, setAssignedUser] = useState<any>(null);
  const [currentFlow, setCurrentFlow] = useState<any>(null);
  const [pipelineTeamMembers, setPipelineTeamMembers] = useState<any[]>([]);
  const [reassigning, setReassigning] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  
  // Onboarding: mark "first_interaction" when a contact profile is viewed
  const { updateProgress, progress, isLoading: onboardingLoading } = useMemberOnboarding(user?.id);
  useEffect(() => {
    if (user?.id && contactId && !onboardingLoading && !progress.first_interaction) {
      updateProgress('first_interaction', true);
    }
  }, [user?.id, contactId, onboardingLoading, progress.first_interaction, updateProgress]);
  
  // Get tag suggestions for the organization
  const { suggestions: tagSuggestions } = useOrgTagSuggestions(organization?.id);
  const { data: engagementScore } = useEngagementScore(contactId);
  // Fetch comprehensive contact data
  const { data: contactData, isLoading, error } = useQuery({
    queryKey: ["contact-comprehensive", contactId],
    queryFn: async () => {
      if (!contactId) throw new Error("Contact ID is required");

      // Fetch basic contact details with campus
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("*, campuses(id, name)")
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
    // Fetch family members
    const { data: rawFamilyMembers } = await supabase
      .from("contact_family_members")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at");

    // Check if each family member exists as a contact
    const familyMembers = await Promise.all(
      (rawFamilyMembers || []).map(async (member) => {
        if (member.pc_person_id) {
          const { data: linkedContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("pc_person_id", member.pc_person_id)
            .maybeSingle();
          
          return { ...member, linked_contact_id: linkedContact?.id || null };
        }
        return { ...member, linked_contact_id: null };
      })
    );

      // Fetch pipeline involvement with stage counts
      const { data: pipelineContacts } = await supabase
        .from("pipeline_contacts")
        .select(`
          *,
          pipelines!inner(id, name, icon, description),
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
            id: pc.id, // Add the pipeline_contacts ID
            pipeline: pc.pipelines,
            currentStage: pc.pipeline_stages,
            totalStages,
            progressPercentage,
            assignedToUserId: pc.assigned_to_user_id // Include assignment info
          });
        }
      }

      // Fetch interactions (we'll enrich with pipeline/stage data separately)
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

      // Fetch call records (with contacts data)
      const { data: callRecords } = await supabase
        .from("call_records")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      // Fetch SMS messages
      const { data: smsMessages } = await supabase
        .from("sms_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      // Combine interactions, notes, prayer requests, calls, and SMS into a unified timeline
      const allInteractions = [
        ...(interactions || []),
        ...(notes || []).map(note => ({
          id: note.id,
          contact_id: note.contact_id,
          pipeline_id: note.pipeline_id,
          interaction_type: 'note',
          subject: note.note_type || 'General Note',
          details: note.content,
          created_at: note.created_at,
          completed_at: note.created_at,
          created_by_user_id: note.created_by_user_id,
          metadata: { is_private: note.is_private, note_type: note.note_type }
        })),
        ...(prayerRequests || []).map(prayer => ({
          id: prayer.id,
          contact_id: prayer.contact_id,
          interaction_type: 'prayer_request',
          subject: prayer.title,
          details: prayer.description,
          outcome: prayer.status === 'answered' ? prayer.answer_description : undefined,
          created_at: prayer.created_at,
          completed_at: prayer.answered_at || prayer.created_at,
          created_by_user_id: prayer.created_by_user_id,
          metadata: { status: prayer.status, answered_at: prayer.answered_at }
        })),
        ...(callRecords || []).map(call => ({
          id: call.id,
          contact_id: call.contact_id,
          interaction_type: 'call',
          subject: `${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} Call`,
          details: call.status === 'completed' && call.duration 
            ? `Duration: ${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
            : call.status,
          created_at: call.created_at,
          completed_at: call.ended_at || call.created_at,
          created_by_user_id: call.initiated_by_user_id,
          metadata: { 
            direction: call.direction, 
            status: call.status,
            duration: call.duration,
            from_number: call.from_number,
            to_number: call.to_number,
            recording_url: call.recording_url
          }
        })),
        ...(smsMessages || []).map(sms => ({
          id: sms.id,
          contact_id: sms.contact_id,
          interaction_type: 'sms',
          subject: `${sms.direction === 'inbound' ? 'Incoming' : 'Outgoing'} SMS`,
          details: sms.body,
          created_at: sms.created_at,
          completed_at: sms.created_at,
          created_by_user_id: sms.sent_by_user_id,
          metadata: { 
            direction: sms.direction, 
            status: sms.status,
            from_number: sms.from_number,
            to_number: sms.to_number
          }
        }))
      ];

      return {
        contact,
        tags: tags?.map(t => t.tag) || [],
        demographics,
        addresses: addresses || [],
        familyMembers: familyMembers || [],
        flows,
        interactions: allInteractions,
        notes: notes || [],
        prayerRequests: prayerRequests || []
      };
    },
    enabled: !!contactId,
  });

  // Fetch assignment for the current pipeline if pipelineId is provided
  useEffect(() => {
    const fetchCurrentFlowAssignment = async () => {
      if (!pipelineId || !contactData?.flows) return;

      const flow = contactData.flows.find((f: any) => f.pipeline.id === pipelineId);
      if (!flow) return;

      setCurrentFlow(flow);

      // Fetch assigned user if exists
      if (flow.assignedToUserId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, avatar_url')
          .eq('user_id', flow.assignedToUserId)
          .single();

        if (profileData) {
          setAssignedUser({
            user_id: profileData.user_id,
            profiles: profileData
          });
        }
      } else {
        setAssignedUser(null);
      }
    };

    fetchCurrentFlowAssignment();
  }, [pipelineId, contactData]);

  // Fetch pipeline team members when reassign dialog opens
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!showReassignDialog || !pipelineId) return;

      // First fetch team member user IDs
      const { data: teamData } = await supabase
        .from('pipeline_team_members')
        .select('user_id, role')
        .eq('pipeline_id', pipelineId);

      if (!teamData || teamData.length === 0) {
        setPipelineTeamMembers([]);
        return;
      }

      // Then fetch their profiles
      const userIds = teamData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url')
        .in('user_id', userIds);

      // Combine the data
      const members = teamData.map(tm => {
        const profile = profilesData?.find(p => p.user_id === tm.user_id);
        return {
          user_id: tm.user_id,
          profiles: profile || null
        };
      }).filter(m => m.profiles !== null);

      setPipelineTeamMembers(members);
    };

    fetchTeamMembers();
  }, [showReassignDialog, pipelineId]);

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

  // Handle reassignment
  const handleReassign = async (newUserId: string) => {
    if (!currentFlow) return;

    setReassigning(true);
    try {
      const { error } = await supabase
        .from('pipeline_contacts')
        .update({ assigned_to_user_id: newUserId === 'unassigned' ? null : newUserId })
        .eq('id', currentFlow.id);

      if (error) throw error;

      // Update local state
      if (newUserId === 'unassigned') {
        setAssignedUser(null);
      } else {
        const member = pipelineTeamMembers.find(m => m.user_id === newUserId);
        if (member) {
          setAssignedUser(member);
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
      // Notify flows to refresh
      window.dispatchEvent(new Event('flow-assignment-updated'));
      setShowReassignDialog(false);
      toast({ title: "Assignment updated successfully" });
    } catch (error) {
      console.error('Error reassigning:', error);
      toast({ title: "Error updating assignment", variant: "destructive" });
    } finally {
      setReassigning(false);
    }
  };

  
  // Handle tag updates
  const handleSaveTags = async () => {
    try {
      // Delete existing tags
      const { error: deleteError } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId);

      if (deleteError) throw deleteError;

      // Insert new tags
      if (editingTags.length > 0) {
        const { error: insertError } = await supabase
          .from('contact_tags')
          .insert(editingTags.map((tag: string) => ({
            contact_id: contactId,
            tag
          })));

        if (insertError) throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
      setShowTagEditor(false);
      toast({ title: "Tags updated successfully" });
    } catch (error) {
      console.error("Error updating tags:", error);
      toast({ 
        title: "Error updating tags", 
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Helper function to get initials from name
  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    if (parts[0]) return parts[0].substring(0, 2).toUpperCase();
    return 'U';
  };

  // Handle contact edit
  const handleEditContact = async (updatedContact: any) => {
    try {
      // Update basic contact information
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          name: updatedContact.name,
          email: updatedContact.email,
          phone: updatedContact.phone,
          status: updatedContact.status,
          notes: updatedContact.notes
        })
        .eq('id', contactId);

      if (contactError) throw contactError;

      // Update tags - delete existing and insert new ones
      if (updatedContact.tags) {
        // Delete existing tags
        const { error: deleteTagsError } = await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId);

        if (deleteTagsError) throw deleteTagsError;

        // Insert new tags
        if (updatedContact.tags.length > 0) {
          const { error: insertTagsError } = await supabase
            .from('contact_tags')
            .insert(updatedContact.tags.map((tag: string) => ({
              contact_id: contactId,
              tag
            })));

          if (insertTagsError) throw insertTagsError;
        }
      }

      // Update or create demographics
      if (updatedContact.birthday || updatedContact.occupation || updatedContact.maritalStatus) {
        const { error: demoError } = await supabase
          .from('contact_demographics')
          .upsert({
            contact_id: contactId,
            birthday: updatedContact.birthday || null,
            occupation: updatedContact.occupation || null,
            marital_status: updatedContact.maritalStatus || null
          });

        if (demoError) throw demoError;
      }

      // Update or create primary address
      if (updatedContact.streetAddress || updatedContact.city || updatedContact.state || updatedContact.zipCode) {
        const { error: addressError } = await supabase
          .from('contact_addresses')
          .upsert({
            contact_id: contactId,
            street_address: updatedContact.streetAddress || null,
            city: updatedContact.city || null,
            state: updatedContact.state || null,
            zip_code: updatedContact.zipCode || null,
            is_primary: true,
            address_type: 'home'
          });

        if (addressError) throw addressError;
      }

      queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
      setIsEditDialogOpen(false);
      toast({ title: "Contact updated successfully" });
    } catch (error) {
      console.error("Error updating contact:", error);
      toast({ 
        title: "Error updating contact", 
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Transform database contact to Contact type format for the dialog
  const getContactForDialog = () => {
    if (!contact) return null;
    
    const demographics = contactData?.demographics;
    const primaryAddress = contactData?.addresses?.find(addr => addr.is_primary) || contactData?.addresses?.[0];
    
    console.log("Demographics data:", demographics);
    console.log("Primary address data:", primaryAddress);
    console.log("All addresses:", contactData?.addresses);
    
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      avatar: contact.avatar,
      date: new Date(contact.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      tags: (tags || []) as any,
      status: contact.status as ContactStatus,
      assignedTo: contact.assigned_to_user_id ? {
        name: "Assigned User", // You'd fetch this from the user profile
        avatar: undefined
      } : undefined,
      notes: contact.notes,
      // Add demographic fields
      birthday: demographics?.birthday || "",
      occupation: demographics?.occupation || "",
      maritalStatus: demographics?.marital_status ? String(demographics.marital_status).toLowerCase() : "",
      streetAddress: primaryAddress?.street_address || "",
      city: primaryAddress?.city || "",
      state: primaryAddress?.state || "",
      zipCode: primaryAddress?.zip_code || "",
    };
  };

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
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full p-4 md:p-6 space-y-6">
        {/* Enhanced Header */}
        <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-4 md:p-6">
            {/* Mobile-only top row: avatar + name + edit */}
            <div className="flex sm:hidden items-start gap-3 mb-4">
              <Avatar
                className={cn(
                  "h-14 w-14 shrink-0",
                  contact.avatar && "cursor-zoom-in transition-transform hover:scale-105"
                )}
                onClick={() => contact.avatar && setShowAvatarPreview(true)}
                role={contact.avatar ? "button" : undefined}
                tabIndex={contact.avatar ? 0 : undefined}
                aria-label={contact.avatar ? `View ${contact.name}'s photo` : undefined}
              >
                <AvatarImage src={contact.avatar} alt={contact.name} />
                <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold break-words leading-tight">{contact.name}</h1>
                <div className="mt-1.5">
                  <EngagementBadge score={engagementScore} />
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsEditDialogOpen(true)}
                className="shrink-0 h-9 w-9"
                title="Edit Contact & Demographics"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-4 relative">
              {/* Edit button — desktop only, top right corner */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="hidden sm:flex absolute top-0 right-0 p-2"
                title="Edit Contact & Demographics"
              >
                <Edit className="h-4 w-4" />
              </Button>

              <div className="flex flex-row sm:flex-col items-center gap-3 w-full sm:w-auto">
                {/* Avatar — desktop only (mobile shows it in the top row above) */}
                <Avatar
                  className={cn(
                    "hidden sm:flex h-16 w-16 shrink-0",
                    contact.avatar && "cursor-zoom-in transition-transform hover:scale-105"
                  )}
                  onClick={() => contact.avatar && setShowAvatarPreview(true)}
                  role={contact.avatar ? "button" : undefined}
                  tabIndex={contact.avatar ? 0 : undefined}
                  aria-label={contact.avatar ? `View ${contact.name}'s photo` : undefined}
                >
                  <AvatarImage src={contact.avatar} alt={contact.name} />
                  <AvatarFallback>
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                {/* Engagement Stats: horizontal on mobile, vertical on desktop */}
                <div className="grid grid-cols-4 sm:grid-cols-1 gap-1.5 flex-1 sm:flex-none w-full">
                  <div className="flex flex-col gap-0.5 p-1.5 rounded-md bg-muted/50 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Score</span>
                    </div>
                    <span className="text-xs font-medium">{engagementScore?.score ?? 0}/100</span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-1.5 rounded-md bg-muted/50 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">12 Weeks</span>
                    </div>
                    <span className="text-xs font-medium">{engagementScore?.weeks_attended_last_12 ?? 0}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-1.5 rounded-md bg-muted/50 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Streak</span>
                    </div>
                    <span className="text-xs font-medium">{engagementScore?.streak_weeks ? `${engagementScore.streak_weeks}w` : '—'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 p-1.5 rounded-md bg-muted/50 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Last</span>
                    </div>
                    <span className="text-xs font-medium">{engagementScore?.last_checkin_at ? new Date(engagementScore.last_checkin_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 w-full">
                {/* Name + engagement badge — desktop only (mobile shows them in top row above) */}
                <div className="hidden sm:block pr-10">
                  <h1 className="text-3xl font-bold break-words">{contact.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <EngagementBadge score={engagementScore} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Tags className="h-3.5 w-3.5 text-muted-foreground" />
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  
                  {/* Tag Editor Popover */}
                  <Popover open={showTagEditor} onOpenChange={setShowTagEditor}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setEditingTags([...tags]);
                          setShowTagEditor(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Manage Tags</h4>
                          <TagManager
                            tags={editingTags}
                            onTagsChange={setEditingTags}
                            suggestions={tagSuggestions}
                            placeholder="Type to add tags..."
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowTagEditor(false);
                              setEditingTags([...tags]);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSaveTags}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Campus / Location — surfaced high so it's visible at a glance */}
                {contact.campuses?.name && (
                  <div className="flex items-center gap-1.5 mt-2 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{contact.campuses.name}</span>
                  </div>
                )}

                {/* Board Assignment - only show if we have a pipelineId context */}
                {currentFlow && (
                  <div className="mt-3">
                    <div 
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors border border-border/50 max-w-fit"
                      onClick={() => setShowReassignDialog(true)}
                      title={assignedUser 
                        ? `Assigned to: ${assignedUser.profiles?.full_name || assignedUser.profiles?.email || 'Unknown User'}`
                        : 'Click to assign'}
                    >
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      {assignedUser ? (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={assignedUser.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                             {getInitials(assignedUser.profiles?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">?</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Contact Details */}
                <div className="mt-4 space-y-2">
                  {(contact.email || contact.phone) && (
                    <div className="text-sm text-muted-foreground space-y-1">
                  {contact.email && (
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <button 
                        onClick={() => window.open(`mailto:${contact.email}`)}
                        className="hover:text-primary cursor-pointer transition-colors"
                      >
                        {contact.email}
                      </button>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Phone: </span>
                      <span>{contact.phone}</span>
                      <div className="flex items-center gap-2 sm:ml-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (shouldUseTwilio) {
                              initiateCall.mutate(
                                { contactId: contact.id },
                                {
                                  onSuccess: (callData) => {
                                    setActiveCall(callData);
                                    setActiveCallId(callData.id);
                                    setShowCallDialog(true);
                                  }
                                }
                              );
                            } else {
                              window.open(`tel:${contact.phone}`);
                            }
                          }}
                          className="h-8"
                        >
                          <Phone className="h-3.5 w-3.5 mr-1.5" />
                          Call
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (shouldUseTwilio) {
                              navigate(`/messages?contactId=${contact.id}`);
                            } else {
                              window.open(`sms:${contact.phone}`);
                            }
                          }}
                          className="h-8"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                          Text
                        </Button>
                      </div>
                    </div>
                      )}
                    </div>
                  )}
                  
                  {/* Demographics Information */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="space-y-3">
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                        {/* Demographics */}
                        {demographics && (
                          <>
                            {demographics.gender && (
                              <div>
                                <span className="text-muted-foreground">Gender: </span>
                                <span>{demographics.gender}</span>
                              </div>
                            )}
                            {demographics.birthday && (
                              <div>
                                <span className="text-muted-foreground">Age: </span>
                                <span>{(() => {
                                  const today = new Date();
                                  const birthDate = new Date(demographics.birthday);
                                  let age = today.getFullYear() - birthDate.getFullYear();
                                  const monthDiff = today.getMonth() - birthDate.getMonth();
                                  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                    age--;
                                  }
                                  return age;
                                })()}</span>
                              </div>
                            )}
                            {demographics.marital_status && (
                              <div>
                                <span className="text-muted-foreground">Marital Status: </span>
                                <span>{demographics.marital_status}</span>
                              </div>
                            )}
                            {demographics.occupation && (
                              <div>
                                <span className="text-muted-foreground">Occupation: </span>
                                <span>{demographics.occupation}</span>
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Primary Address */}
                        {(() => {
                          const primaryAddress = addresses?.find(addr => addr.is_primary) || addresses?.[0];
                          if (primaryAddress) {
                            const addressParts = [
                              primaryAddress.street_address,
                              primaryAddress.city,
                              primaryAddress.state,
                              primaryAddress.zip_code
                            ].filter(Boolean);
                            if (addressParts.length > 0) {
                              return (
                                <div className="sm:col-span-2 lg:col-span-1">
                                  <span className="text-muted-foreground">Address: </span>
                                  <span>{addressParts.join(', ')}</span>
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                        
                        {/* Show placeholders if no demographics data */}
                        {!demographics?.birthday && !demographics?.occupation && !demographics?.marital_status && !addresses?.length && (
                          <div className="col-span-full">
                            <span className="text-muted-foreground text-sm">No demographic information available</span>
                          </div>
                        )}
                      </div>

                      {/* Household Members - Compact Inline Avatars */}
                      {familyMembers && familyMembers.length > 0 && (
                        <div className="pt-3 border-t border-border/40 mt-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">Household:</span>
                            <div className="flex -space-x-2">
                              {familyMembers.map((member: any) => (
                                <TooltipProvider key={member.id}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => {
                                          if (member.linked_contact_id) {
                                            navigate(`/contacts/${member.linked_contact_id}`);
                                          }
                                        }}
                                        className={member.linked_contact_id ? "cursor-pointer" : "cursor-default"}
                                      >
                                        <Avatar className={`h-8 w-8 border-2 border-background transition-transform ${
                                          member.linked_contact_id ? 'hover:scale-110 hover:border-primary' : ''
                                        }`}>
                                          <AvatarImage src={member.avatar} />
                                          <AvatarFallback className="text-xs">
                                            {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="font-medium">{member.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {member.is_child ? 'Child' : 'Adult'}
                                        {member.relationship && ` • ${member.relationship}`}
                                      </p>
                                      {member.linked_contact_id && (
                                        <p className="text-xs text-primary mt-1">Click to view profile</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              ({familyMembers.length} member{familyMembers.length > 1 ? 's' : ''})
                            </span>
                          </div>
                        </div>
                      )}
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flow Moments */}
      <FlowMomentsCard contactId={contactId!} />

      {/* Planning Center custom fields (per-user) */}
      <PcoCustomFieldsCard contactId={contactId!} />

      {/* Attendance / Check-ins */}
      <ContactCheckinsCard contactId={contactId!} />

      {/* Groups */}
      <ContactGroupsCard contactId={contactId!} />

      {/* AI Suggestions Block */}
      <AISuggestions 
        contactId={contactId!}
        contactName={contact?.name}
        contactPhone={contact?.phone}
        contactEmail={contact?.email}
        currentPipelineId={pipelineId || undefined}
        currentPipelineName={contactData?.flows?.find((f: any) => f.pipeline.id === pipelineId)?.pipeline?.name}
        flows={contactData?.flows}
      />

      {/* Vertical Content Blocks */}
      <div className="space-y-6">
        {/* Flow Status Block */}
        <ContactFlowStatus flows={flows} contactId={contactId!} />
        
        {/* Family Members Block (if any) */}
        {familyMembers && familyMembers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Family Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {familyMembers.map((member) => (
                  <div key={member.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{member.relationship}</div>
                    </div>
                    {member.birthday && (
                      <div className="text-sm text-muted-foreground">
                        Age {(() => {
                          const today = new Date();
                          const birthDate = new Date(member.birthday);
                          let age = today.getFullYear() - birthDate.getFullYear();
                          const monthDiff = today.getMonth() - birthDate.getMonth();
                          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                          }
                          return age;
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Recent Interactions Block */}
        <InteractionTimeline
          interactions={interactions}
          onAddInteraction={() => toast({ title: "Add interaction feature coming soon" })}
        />
        
        {/* Notes Block */}
        <ContactNotes
          notes={notes}
          onAddNote={(content, noteType, isPrivate) => 
            addNoteMutation.mutate({ content, noteType, isPrivate })
          }
        />
        
        {/* Prayer Requests Block */}
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

      {/* Edit Contact Dialog */}
      <ContactFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        contact={getContactForDialog()}
        onSave={handleEditContact}
      />

      {/* Reassignment Dialog */}
      {currentFlow && (
        <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Reassign Contact on {currentFlow.pipeline.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to team member:</label>
                <Select
                  onValueChange={handleReassign}
                  disabled={reassigning}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={
                      reassigning ? "Reassigning..." : "Select team member"
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="unassigned" className="bg-background hover:bg-muted">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          <UserCheck className="h-3 w-3" />
                        </div>
                        Unassigned
                      </div>
                    </SelectItem>
                    {pipelineTeamMembers.map((member: any) => (
                      <SelectItem 
                        key={member.user_id} 
                        value={member.user_id}
                        className="bg-background hover:bg-muted"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.profiles?.full_name || '')}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {member.profiles?.full_name || member.profiles?.email || 'Unknown User'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <CallStatusDialog
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        callRecord={activeCall}
        contactName={contactData?.contact.name || 'Unknown'}
        contactAvatar={contactData?.contact.avatar}
        contactPhone={contactData?.contact.phone}
      />

      {/* Avatar full-size preview */}
      <Dialog open={showAvatarPreview} onOpenChange={setShowAvatarPreview}>
        <DialogContent className="max-w-lg p-2 bg-transparent border-none shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{contact?.name}'s photo</DialogTitle>
          </DialogHeader>
          {contact?.avatar && (
            <img
              src={contact.avatar}
              alt={contact.name}
              className="w-full h-auto rounded-lg object-contain max-h-[80vh]"
            />
          )}
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
};

export default UserProfilePage;