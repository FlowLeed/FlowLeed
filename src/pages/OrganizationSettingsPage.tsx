import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield, Phone, Pencil } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrganizationPhoneNumbers } from "@/components/admin/OrganizationPhoneNumbers";

const OrganizationSettingsPage = () => {
  const { organization, profile } = useProfile();
  const [orgName, setOrgName] = useState(organization?.name || "");
  const [isEditingOrgName, setIsEditingOrgName] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');

  const handleUpdateOrgName = async () => {
    if (!organization || !orgName.trim() || orgName === organization.name) {
      setIsEditingOrgName(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: orgName.trim() })
        .eq('id', organization.id);

      if (error) throw error;

      toast.success('Organization name updated');
      setIsEditingOrgName(false);
    } catch (error) {
      console.error('Error updating organization name:', error);
      toast.error('Failed to update organization name');
      setOrgName(organization.name);
    }
  };

  // Fetch current user's role
  useEffect(() => {
    const fetchRole = async () => {
      if (!organization || !profile) return;

      const { data } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization.id)
        .eq('user_id', profile.user_id)
        .single();

      if (data) {
        setCurrentUserRole(data.role);
      }
    };

    fetchRole();
  }, [organization, profile]);

  const isOwner = currentUserRole === 'owner';
  const canManageSettings = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Organization Settings" showFlowIcon={false} showAddButton={false} />
      
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">
              <Shield className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="phone-numbers">
              <Phone className="h-4 w-4 mr-2" />
              Phone Numbers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>
                  Manage your organization's basic information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="orgName"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={!isOwner || !isEditingOrgName}
                      className="flex-1"
                    />
                    {isOwner && (
                      <>
                        {!isEditingOrgName ? (
                          <Button
                            variant="outline"
                            onClick={() => setIsEditingOrgName(true)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        ) : (
                          <>
                            <Button variant="default" onClick={handleUpdateOrgName}>
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setOrgName(organization.name);
                                setIsEditingOrgName(false);
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {!isOwner && (
                    <p className="text-sm text-muted-foreground">
                      Only organization owners can change the organization name.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Organization ID</Label>
                  <Input value={organization.id} disabled className="font-mono text-xs" />
                  <p className="text-sm text-muted-foreground">
                    Use this ID for API integrations and support requests.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="phone-numbers" className="space-y-6 mt-6">
            {canManageSettings ? (
              <OrganizationPhoneNumbers organizationId={organization.id} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Phone Numbers</CardTitle>
                  <CardDescription>
                    Only organization owners and admins can manage phone numbers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Contact your organization owner or admin to request access to phone number management.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default OrganizationSettingsPage;
