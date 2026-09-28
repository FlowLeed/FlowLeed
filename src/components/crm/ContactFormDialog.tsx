import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Contact, Tag } from "@/types/crm";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { TagManager } from "@/components/contact/TagManager";
import { useOrgTagSuggestions } from "@/hooks/useContactTags";
import { useQuery } from "@tanstack/react-query";

export interface FlowEnrollmentData {
  pipelineId: string;
  stageId: string;
  stageOrder: number;
  defaultAssigneeUserId?: string | null;
}

interface OrganizationMember {
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSave: (contact: Contact, flowData?: FlowEnrollmentData | null, addAnother?: boolean) => void;
  flowId?: string; // Optional flow ID to filter team members
}

export const ContactFormDialog: React.FC<ContactFormDialogProps> = ({
  open,
  onOpenChange,
  contact,
  onSave,
  flowId,
}) => {
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const { profile, organization } = useProfile();
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Flow enrollment state
  const [addToFlow, setAddToFlow] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  
  // Get tag suggestions for the organization
  const { suggestions: tagSuggestions } = useOrgTagSuggestions(organization?.id);

  // Fetch pipelines for the organization
  const { data: pipelines } = useQuery({
    queryKey: ['org-pipelines', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, description, icon')
        .eq('organization_id', organization!.id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open && addToFlow && !!organization
  });

  // Fetch stages when a pipeline is selected
  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages', selectedPipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, name, color, stage_order, default_assignee_user_id, is_start_step')
        .eq('pipeline_id', selectedPipelineId!)
        .order('stage_order');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPipelineId
  });

  // Auto-select start stage when pipeline changes
  useEffect(() => {
    if (stages && stages.length > 0) {
      const startStage = stages.find(s => s.is_start_step);
      setSelectedStageId(startStage?.id || stages[0].id);
    } else {
      setSelectedStageId(null);
    }
  }, [stages]);
  const [formData, setFormData] = useState<Partial<Contact & {
    birthday?: string;
    occupation?: string;
    maritalStatus?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }>>({
    name: "",
    date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
    tags: [],
    status: "active",
    assignedTo: profile ? {
      name: profile.full_name || profile.email,
      avatar: profile.avatar_url || undefined
    } : undefined,
    email: "",
    phone: "",
    birthday: "",
    occupation: "",
    maritalStatus: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });

  // Normalize values coming from external sources (e.g., PCO)
  const normalizeMaritalStatus = (value?: string) => (value ? String(value).trim().toLowerCase() : "");

  // Fetch flow team members or organization members when dialog opens
  useEffect(() => {
    if (open) {
      if (flowId) {
        fetchFlowTeamMembers();
      } else if (organization) {
        fetchOrganizationMembers();
      }
    }
  }, [open, flowId, organization]);

  const fetchFlowTeamMembers = async () => {
    if (!flowId) return;

    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('pipeline_team_members')
        .select(`
          user_id,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('pipeline_id', flowId);

      if (error) throw error;

      const members: OrganizationMember[] = data.map((m: any) => ({
        user_id: m.user_id,
        profiles: m.profiles
      }));

      setOrganizationMembers(members);
    } catch (error) {
      console.error('Error fetching flow team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchOrganizationMembers = async () => {
    if (!organization) return;

    setLoadingMembers(true);
    try {
      // First get organization members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization.id);

      if (membersError) throw membersError;

      if (members && members.length > 0) {
        // Then get profiles for these users
        const userIds = members.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const combinedData: OrganizationMember[] = members.map(member => ({
          user_id: member.user_id,
          profiles: profiles?.find(p => p.user_id === member.user_id) || null
        }));

        setOrganizationMembers(combinedData);
      }
    } catch (error) {
      console.error('Error fetching organization members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (contact) {
      console.log("Setting form data with contact:", contact);
      const extendedContact = contact as any; // Type assertion for extended properties
      setFormData({
        ...contact,
        // Ensure all demographic fields are included
        birthday: extendedContact.birthday || "",
        occupation: extendedContact.occupation || "",
        maritalStatus: normalizeMaritalStatus(extendedContact.maritalStatus || ""),
        streetAddress: extendedContact.streetAddress || "",
        city: extendedContact.city || "",
        state: extendedContact.state || "",
        zipCode: extendedContact.zipCode || "",
      });
      // Reset flow state when editing existing contact
      setAddToFlow(false);
      setSelectedPipelineId(null);
      setSelectedStageId(null);
    } else {
      setFormData({
        name: "",
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        tags: [],
        status: "active",
        assignedTo: profile ? {
          name: profile.full_name || profile.email,
          avatar: profile.avatar_url || undefined
        } : undefined,
        email: "",
        phone: "",
        birthday: "",
        occupation: "",
        maritalStatus: "",
        streetAddress: "",
        city: "",
        state: "",
        zipCode: "",
      });
      // Reset flow state for new contact
      setAddToFlow(false);
      setSelectedPipelineId(null);
      setSelectedStageId(null);
    }
  }, [contact, profile]);

  const handleAssignedToChange = (userId: string) => {
    const selectedMember = organizationMembers.find(member => member.user_id === userId);
    if (selectedMember) {
      handleChange("assignedTo", {
        name: selectedMember.profiles?.full_name || selectedMember.profiles?.email || "Unknown User",
        avatar: undefined // We could fetch this from profiles if needed
      });
    } else if (userId === "unassigned") {
      handleChange("assignedTo", undefined);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTagsChange = (newTags: string[]) => {
    setFormData((prev) => ({ ...prev, tags: newTags }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate an ID if this is a new contact
    const finalContact = {
      id: contact?.id || Math.random().toString(36).substring(2, 10),
      ...formData
    } as Contact;
    
    // Include flow data if selected (only for new contacts)
    const flowData = !contact && addToFlow && selectedPipelineId && selectedStageId
      ? {
          pipelineId: selectedPipelineId,
          stageId: selectedStageId,
          stageOrder: stages?.find(s => s.id === selectedStageId)?.stage_order || 0,
          defaultAssigneeUserId: stages?.find(s => s.id === selectedStageId)?.default_assignee_user_id
        }
      : null;
    
    onSave(finalContact, flowData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact & Demographics" : "Add New Contact"}</DialogTitle>
          <DialogDescription>Update personal details and demographics like birthday, marital status, and address.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>


          <div className="space-y-2">
            <Label>Tags</Label>
            <TagManager
              tags={formData.tags || []}
              onTagsChange={handleTagsChange}
              suggestions={tagSuggestions}
              placeholder="Type to add tags..."
            />
          </div>

          {/* Demographics Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-medium">Demographics</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={formData.birthday || ""}
                  onChange={(e) => handleChange("birthday", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <Input
                  id="occupation"
                  value={formData.occupation || ""}
                  onChange={(e) => handleChange("occupation", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Marital Status</Label>
              <Select
                value={formData.maritalStatus}
                onValueChange={(value) => handleChange("maritalStatus", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select marital status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                  <SelectItem value="widowed">Widowed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Address</h4>
              <div className="space-y-2">
                <Label htmlFor="streetAddress">Street Address</Label>
                <Input
                  id="streetAddress"
                  value={formData.streetAddress || ""}
                  onChange={(e) => handleChange("streetAddress", e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city || ""}
                    onChange={(e) => handleChange("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state || ""}
                    onChange={(e) => handleChange("state", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode || ""}
                    onChange={(e) => handleChange("zipCode", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Add to Flow Section - Only for new contacts */}
          {!contact && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="addToFlow"
                  checked={addToFlow}
                  onCheckedChange={(checked) => {
                    setAddToFlow(!!checked);
                    if (!checked) {
                      setSelectedPipelineId(null);
                      setSelectedStageId(null);
                    }
                  }}
                />
                <Label htmlFor="addToFlow" className="text-sm font-medium cursor-pointer">
                  Add to a flow
                </Label>
              </div>

              {addToFlow && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label>Select Flow</Label>
                    <Select 
                      value={selectedPipelineId || ""} 
                      onValueChange={setSelectedPipelineId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a flow..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pipelines?.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedPipelineId && stages && stages.length > 0 && (
                    <div className="space-y-2">
                      <Label>Select Stage</Label>
                      <Select 
                        value={selectedStageId || ""} 
                        onValueChange={setSelectedStageId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a stage..." />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name} {stage.is_start_step && "(Start)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};