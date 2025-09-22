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

import { ContactFlowStatus } from "@/components/contact/ContactFlowStatus";
import { InteractionTimeline } from "@/components/contact/InteractionTimeline";
import { ContactNotes } from "@/components/contact/ContactNotes";
import { PrayerRequestsList } from "@/components/contact/PrayerRequestsList";
import { QuickActionsBar } from "@/components/contact/QuickActionsBar";
import { AISuggestions } from "@/components/contact/AISuggestions";
import { ContactFormDialog } from "@/components/crm/ContactFormDialog";
import { EditDemographicsDialog } from "@/components/contact/EditDemographicsDialog";
import { ContactStatus } from "@/types/crm";
import { useAuth } from "@/hooks/useAuth";

const UserProfilePage = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDemographicsDialogOpen, setIsDemographicsDialogOpen] = useState(false);

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

  
  // Handle contact edit
  const handleEditContact = (updatedContact: any) => {
    // Here you would typically update the contact in the database
    // For now, we'll just invalidate the query to refetch data
    queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] });
    setIsEditDialogOpen(false);
    toast({ title: "Contact updated successfully" });
  };

  // Transform database contact to Contact type format for the dialog
  const getContactForDialog = () => {
    if (!contact) return null;
    
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      avatar: contact.avatar,
      date: new Date(contact.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      tags: [], // You may need to map tags from the database format
      status: contact.status as ContactStatus,
      assignedTo: contact.assigned_to_user_id ? {
        name: "Assigned User", // You'd fetch this from the user profile
        avatar: undefined
      } : undefined,
      notes: contact.notes
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
    <div className="w-full p-6 space-y-6">
      {/* Enhanced Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative">
              {/* Edit button in top right corner */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="absolute top-0 right-0 p-2"
                title="Edit Contact"
              >
                <Edit className="h-4 w-4" />
              </Button>
              
              <Avatar className="h-16 w-16">
                <AvatarImage src={contact.avatar} alt={contact.name} />
                <AvatarFallback>
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{contact.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant={contact.status === 'active' ? 'default' : 'secondary'}>
                    {contact.status}
                  </Badge>
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                {/* Contact Details */}
                <div className="mt-4 space-y-2">
                  {(contact.email || contact.phone) && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {contact.email && (
                        <button 
                          onClick={() => window.open(`mailto:${contact.email}`)}
                          className="hover:text-primary cursor-pointer transition-colors block"
                        >
                          <Mail className="h-4 w-4 inline mr-2" />
                          {contact.email}
                        </button>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{contact.phone}</span>
                          <button 
                            onClick={() => window.open(`tel:${contact.phone}`)}
                            className="hover:text-primary cursor-pointer transition-colors p-1"
                            title="Call"
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => window.open(`sms:${contact.phone}`)}
                            className="hover:text-primary cursor-pointer transition-colors p-1"
                            title="Text"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Demographics Information */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-start justify-between">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm flex-1">
                        {/* Demographics */}
                        {demographics && (
                          <>
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
                            {demographics.occupation && (
                              <div>
                                <span className="text-muted-foreground">Occupation: </span>
                                <span>{demographics.occupation}</span>
                              </div>
                            )}
                            {demographics.marital_status && (
                              <div>
                                <span className="text-muted-foreground">Marital Status: </span>
                                <span>{demographics.marital_status}</span>
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
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDemographicsDialogOpen(true)}
                        className="ml-2 shrink-0"
                        title="Edit Demographics"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


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

        {/* AI Suggestions Block */}
        <AISuggestions />
      </div>

      {/* Edit Contact Dialog */}
      <ContactFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        contact={getContactForDialog()}
        onSave={handleEditContact}
      />

      {/* Edit Demographics Dialog */}
      <EditDemographicsDialog
        open={isDemographicsDialogOpen}
        onOpenChange={setIsDemographicsDialogOpen}
        contactId={contactId!}
        demographics={contactData?.demographics}
        addresses={contactData?.addresses}
        familyMembers={contactData?.familyMembers}
        onSave={() => queryClient.invalidateQueries({ queryKey: ["contact-comprehensive", contactId] })}
      />
    </div>
  );
};

export default UserProfilePage;