import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, Bell, Shield, Palette, Globe, Mail, Phone, MapPin, Upload, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useTwilioNumbers } from "@/hooks/useTwilioNumbers";
import { useMemberOnboarding } from "@/hooks/useMemberOnboarding";
import { SecuritySettings } from "@/components/profile/SecuritySettings";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
const ProfilePage = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const {
    profile,
    organization,
    loading
  } = useProfile();
  const { numbers: twilioNumbers } = useTwilioNumbers();
  const { updateProgress } = useMemberOnboarding(user?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  const myTwilioNumber = twilioNumbers.find(num => num.assigned_to_user_id === user?.id);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    jobTitle: "",
    department: ""
  });
  const [useTwilioIntegration, setUseTwilioIntegration] = useState(true);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true);

  // Update form data when profile loads
  useEffect(() => {
    if (profile && user) {
      const fullName = profile.full_name || '';
      const [firstName = '', lastName = ''] = fullName.split(' ');
      setFormData({
        firstName,
        lastName,
        email: user.email || '',
        phone: (profile as any).phone || '',
        location: (profile as any).location || '',
        bio: (profile as any).bio || '',
        jobTitle: (profile as any).job_title || '',
        department: (profile as any).department || ''
      });
      setUseTwilioIntegration(profile.use_twilio_integration ?? true);
      
      // Set email digest preference from profile
      const notifPrefs = (profile as any).notification_preferences;
      setEmailDigestEnabled(notifPrefs?.email_digest_enabled !== false);
    }
  }, [profile, user]);
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: false,
    pipelineUpdates: true,
    contactActivity: true,
    weeklyReports: false
  });
  const [preferences, setPreferences] = useState({
    theme: "system",
    language: "en",
    timezone: "America/New_York"
  });
  const handleSave = async () => {
    if (!user) return;
    try {
      // Combine first and last name for full_name
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      // Update profile in database with all form fields
      const {
        error
      } = await supabase.from('profiles').update({
        full_name: fullName || null,
        use_twilio_integration: useTwilioIntegration,
        phone: formData.phone || null,
        location: formData.location || null,
        bio: formData.bio || null,
        job_title: formData.jobTitle || null,
        department: formData.department || null,
        notification_preferences: {
          email_digest_enabled: emailDigestEnabled
        }
      }).eq('user_id', user.id);
      if (error) throw error;
      
      // Update member onboarding progress
      await updateProgress('profile_completed', true);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully."
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Save failed",
        description: "Failed to save your profile. Please try again.",
        variant: "destructive"
      });
    }
  };
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handlePreferenceChange = (field: string, value: string) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }
    setUploading(true);
    try {
      // Delete existing avatar if it exists
      if (profile?.avatar_url) {
        const existingPath = profile.avatar_url.split('/').pop();
        if (existingPath) {
          await supabase.storage.from('avatars').remove([`${user.id}/${existingPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Update profile with new avatar URL
      const {
        error: updateError
      } = await supabase.from('profiles').update({
        avatar_url: publicUrl
      }).eq('user_id', user.id);
      if (updateError) throw updateError;
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully."
      });

      // Refresh the page to show the new avatar
      window.location.reload();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };
  const handleChangeAvatarClick = () => {
    fileInputRef.current?.click();
  };
  if (loading) {
    return <div className="flex flex-col h-screen overflow-hidden">
        <Header 
          title="My Profile" 
          description={`${organization?.name || ''} • Manage your account settings and preferences`}
          showBackButton={true}
          onBackClick={() => navigate(-1)}
          showFlowIcon={false}
          showAddButton={false}
        />
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>;
  }
  return <div className="flex flex-col h-screen overflow-hidden">
      <Header 
        title="My Profile" 
        description={`${organization?.name || ''} • Manage your account settings and preferences`}
        showBackButton={true}
        onBackClick={() => navigate(-1)}
        showFlowIcon={false}
        showAddButton={false}
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6 pb-12">
        {/* Personal Information Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <User className="h-5 w-5 text-sidebar-foreground" />
              </div>
              <div>
                <CardTitle className="font-light">Personal Information</CardTitle>
                <CardDescription>Update your personal details and profile information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url || ""} alt="Profile picture" />
                <AvatarFallback className="text-lg">
                  {formData.firstName ? formData.firstName[0] : ''}
                  {formData.lastName ? formData.lastName[0] : ''}
                  {!formData.firstName && !formData.lastName && user?.email ? user.email[0].toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                <Button variant="outline" className="mb-2" onClick={handleChangeAvatarClick} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Change Avatar"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Recommended: Square image, at least 400x400px (Max 5MB)
                </p>
              </div>
            </div>

            <Separator />

            {/* Personal Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={formData.firstName} onChange={e => handleInputChange("firstName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={formData.lastName} onChange={e => handleInputChange("lastName", e.target.value)} />
              </div>
            </div>

            {/* Twilio Phone Number Section */}
            {myTwilioNumber && (
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium">Assigned Phone Number</Label>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-mono">{myTwilioNumber.phone_number}</span>
                      {myTwilioNumber.friendly_name && (
                        <Badge variant="secondary" className="text-xs">
                          {myTwilioNumber.friendly_name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      This is your dedicated phone number for calls and SMS
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {myTwilioNumber.capabilities.voice && (
                      <Badge variant="outline" className="text-xs">Voice</Badge>
                    )}
                    {myTwilioNumber.capabilities.sms && (
                      <Badge variant="outline" className="text-xs">SMS</Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Use for calls & messages</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, calls and texts will use your assigned Twilio number. 
                      When disabled, your device's native phone/SMS app will be used.
                    </p>
                  </div>
                  <Switch 
                    checked={useTwilioIntegration}
                    onCheckedChange={setUseTwilioIntegration}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={formData.phone} onChange={e => handleInputChange("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={formData.location} onChange={e => handleInputChange("location", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input id="jobTitle" value={formData.jobTitle} onChange={e => handleInputChange("jobTitle", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={formData.department} onValueChange={value => handleInputChange("department", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="pastoral-care">Pastoral Care</SelectItem>
                    <SelectItem value="host-team">Host Team</SelectItem>
                    <SelectItem value="giving-hub">Giving Hub</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={formData.bio} onChange={e => handleInputChange("bio", e.target.value)} placeholder="Tell us about yourself..." className="min-h-[100px]" />
            </div>
            
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} className="w-full sm:w-auto">
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences Card - Hidden for now */}
        {/* 
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Bell className="h-5 w-5 text-sidebar-foreground" />
              </div>
              <div>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified about updates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch checked={notifications.emailNotifications} onCheckedChange={value => handleNotificationChange("emailNotifications", value)} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive push notifications in your browser</p>
                </div>
                <Switch checked={notifications.pushNotifications} onCheckedChange={value => handleNotificationChange("pushNotifications", value)} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Pipeline Updates</Label>
                  <p className="text-sm text-muted-foreground">Get notified when people move between stages</p>
                </div>
                <Switch checked={notifications.pipelineUpdates} onCheckedChange={value => handleNotificationChange("pipelineUpdates", value)} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>People Activity</Label>
                  <p className="text-sm text-muted-foreground">Notifications when people are updated or added</p>
                </div>
                <Switch checked={notifications.contactActivity} onCheckedChange={value => handleNotificationChange("contactActivity", value)} />
              </div>

              <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Weekly Reports</Label>
                <p className="text-sm text-muted-foreground">Receive weekly summary reports</p>
              </div>
              <Switch checked={notifications.weeklyReports} onCheckedChange={value => handleNotificationChange("weeklyReports", value)} />
            </div>
          </CardContent>
        </Card>
        */}

        <NotificationSettings 
          emailDigestEnabled={emailDigestEnabled}
          onEmailDigestChange={setEmailDigestEnabled}
        />

        <SecuritySettings />
      </div>
    </div>;
};
export default ProfilePage;