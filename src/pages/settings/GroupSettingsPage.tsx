import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useIsOrgAdmin } from "@/hooks/useIsOrgAdmin";
import { useGroupTypes, GroupTypeDefinition } from "@/hooks/useGroupTypes";
import {
  useGroupSettings,
  DEFAULT_SIGNUP_CONFIRMATION_SUBJECT,
  DEFAULT_SIGNUP_CONFIRMATION_BODY,
  DEFAULT_LEADER_NOTIFICATION_SUBJECT,
  DEFAULT_LEADER_NOTIFICATION_BODY,
} from "@/hooks/useGroupSettings";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus, Pencil, Trash2, Lock, Mail, BellRing, Reply } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const VariableHelp = ({ tokens }: { tokens: string[] }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-xs text-muted-foreground">Available variables:</span>
    {tokens.map((t) => (
      <Badge key={t} variant="secondary" className="font-mono text-[11px]">{`{{${t}}}`}</Badge>
    ))}
  </div>
);

const GroupSettingsPage = () => {
  const { organization } = useProfile();
  const { user } = useAuth();
  const { isOrgAdmin, isLoading: roleLoading } = useIsOrgAdmin(user?.id);
  const orgId = organization?.id;

  const { types, createType, updateType, deleteType } = useGroupTypes(orgId, { includeInactive: true });
  const { settings, updateSettings, isLoading: settingsLoading } = useGroupSettings(orgId);

  const [editingType, setEditingType] = useState<GroupTypeDefinition | null>(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [customFreq, setCustomFreq] = useState(false);

  const [confirmSubject, setConfirmSubject] = useState("");
  const [confirmBody, setConfirmBody] = useState("");
  const [leaderSubject, setLeaderSubject] = useState("");
  const [leaderBody, setLeaderBody] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [commLoaded, setCommLoaded] = useState(false);

  useEffect(() => {
    if (!settings || commLoaded) return;
    const st = settings as any;
    setConfirmSubject(st.signup_confirmation_subject ?? DEFAULT_SIGNUP_CONFIRMATION_SUBJECT);
    setConfirmBody(st.signup_confirmation_body ?? DEFAULT_SIGNUP_CONFIRMATION_BODY);
    setLeaderSubject(st.leader_notification_subject ?? DEFAULT_LEADER_NOTIFICATION_SUBJECT);
    setLeaderBody(st.leader_notification_body ?? DEFAULT_LEADER_NOTIFICATION_BODY);
    setReplyTo(st.communication_reply_to ?? "");
    setCommLoaded(true);
  }, [settings, commLoaded]);



  const openNewType = () => {
    setEditingType({
      id: "",
      organization_id: orgId || "",
      key: "",
      label: "",
      icon: "Users",
      color: "#6366f1",
      sort_order: types.length,
      is_active: true,
      is_system: false,
    });
    setTypeDialogOpen(true);
  };

  const saveType = async () => {
    if (!editingType) return;
    const key = editingType.key || editingType.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (editingType.id) {
      await updateType.mutateAsync({
        id: editingType.id,
        updates: {
          label: editingType.label,
          icon: editingType.icon,
          color: editingType.color,
          is_active: editingType.is_active,
        },
      });
    } else {
      await createType.mutateAsync({ ...editingType, key });
    }
    setTypeDialogOpen(false);
  };

  if (roleLoading || settingsLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading…</div>;
  }

  if (!isOrgAdmin) {
    return (
      <div className="flex-1 p-6">
        <Card className="max-w-md mx-auto text-center py-12">
          <CardContent>
            <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p>You must be an organization admin to view group settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = settings || ({} as any);

  const patch = (u: any) => updateSettings.mutate(u);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Group Settings" />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Tabs defaultValue="types">
          <TabsList>
            <TabsTrigger value="types">Group Types</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="directory">Public Directory</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
          </TabsList>


          <TabsContent value="types" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Group Types</CardTitle>
                  <CardDescription>Categorize your groups. Built-in types can be renamed or disabled but not deleted.</CardDescription>
                </div>
                <Button onClick={openNewType}><Plus className="h-4 w-4 mr-1" /> New Type</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {types.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="h-6 w-6 rounded" style={{ background: t.color }} />
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {t.label}
                        {t.is_system && <Badge variant="outline" className="text-[10px]">Built-in</Badge>}
                        {t.source === "pco" && <Badge variant="outline" className="text-[10px] border-sky-500 text-sky-600">PCO</Badge>}
                        {!t.is_active && <Badge variant="secondary" className="text-[10px]">Disabled</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{t.key}</div>
                    </div>
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={(v) => updateType.mutate({ id: t.id, updates: { is_active: v } })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => { setEditingType(t); setTypeDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!t.is_system && (
                      <Button variant="ghost" size="icon" onClick={() => deleteType.mutate(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                {types.length === 0 && <p className="text-sm text-muted-foreground">No types yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="defaults">
            <Card>
              <CardHeader>
                <CardTitle>New Group Defaults</CardTitle>
                <CardDescription>Values pre-filled when creating a new group.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meeting Frequency</Label>
                    {(() => {
                      const presets = ["weekly", "biweekly", "monthly"];
                      const value = s.default_meeting_frequency || "weekly";
                      const isCustom = customFreq || !presets.includes(value);
                      return (
                        <>
                          <Select
                            value={isCustom ? "__custom__" : value}
                            onValueChange={(v) => {
                              if (v === "__custom__") {
                                setCustomFreq(true);
                              } else {
                                setCustomFreq(false);
                                patch({ default_meeting_frequency: v });
                              }
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Bi-weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="__custom__">Custom…</SelectItem>
                            </SelectContent>
                          </Select>
                          {isCustom && (
                            <Input
                              defaultValue={presets.includes(value) ? "" : value}
                              onBlur={(e) => patch({ default_meeting_frequency: e.target.value })}
                              placeholder="e.g. 1st & 3rd Tuesday"
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <Select value={s.default_visibility || "private"} onValueChange={(v) => patch({ default_visibility: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Capacity</Label>
                    <Input type="number" value={s.default_capacity ?? ""} onChange={(e) => patch({ default_capacity: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                  <div className="flex items-center justify-between pt-6">
                    <Label>Allow public signup by default</Label>
                    <Switch checked={!!s.default_allow_public_signup} onCheckedChange={(v) => patch({ default_allow_public_signup: v })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="directory">
            <Card>
              <CardHeader>
                <CardTitle>Public Directory</CardTitle>
                <CardDescription>How your groups appear at /{organization?.slug}/groups.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Directory enabled</Label>
                    <p className="text-xs text-muted-foreground">Turn off to hide the public directory entirely.</p>
                  </div>
                  <Switch checked={s.directory_enabled ?? true} onCheckedChange={(v) => patch({ directory_enabled: v })} />
                </div>
                <div className="space-y-2">
                  <Label>Hero title</Label>
                  <Input value={s.directory_hero_title || ""} onChange={(e) => patch({ directory_hero_title: e.target.value })} placeholder="Find Your Community" />
                </div>
                <div className="space-y-2">
                  <Label>Hero subtitle</Label>
                  <Textarea value={s.directory_hero_subtitle || ""} onChange={(e) => patch({ directory_hero_subtitle: e.target.value })} rows={2} />
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Show on cards</Label>
                  <div className="flex items-center justify-between"><span className="text-sm">Meeting time</span><Switch checked={s.directory_show_meeting_time ?? true} onCheckedChange={(v) => patch({ directory_show_meeting_time: v })} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">Location</span><Switch checked={s.directory_show_location ?? true} onCheckedChange={(v) => patch({ directory_show_location: v })} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">Capacity</span><Switch checked={s.directory_show_capacity ?? true} onCheckedChange={(v) => patch({ directory_show_capacity: v })} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lifecycle">
            <Card>
              <CardHeader>
                <CardTitle>Lifecycle Automation</CardTitle>
                <CardDescription>Keep group data fresh automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Auto-mark inactive after (weeks with no attendance)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Disabled"
                    value={s.auto_inactive_weeks ?? ""}
                    onChange={(e) => patch({ auto_inactive_weeks: e.target.value ? parseInt(e.target.value) : null })}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to disable.</p>
                </div>
                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Weekly attendance reminders to leaders</Label>
                    <Switch checked={s.attendance_reminder_enabled ?? false} onCheckedChange={(v) => patch({ attendance_reminder_enabled: v })} />
                  </div>
                  {s.attendance_reminder_enabled && (
                    <div className="space-y-2">
                      <Label>Reminder day</Label>
                      <Select value={String(s.attendance_reminder_day ?? 1)} onValueChange={(v) => patch({ attendance_reminder_day: parseInt(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Signup Confirmation Email</CardTitle>
                <CardDescription>Sent to the person right after they submit a group signup request.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Send confirmation email</Label>
                  <Switch
                    checked={s.signup_confirmation_enabled ?? true}
                    onCheckedChange={(v) => patch({ signup_confirmation_enabled: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={confirmSubject}
                    onChange={(e) => setConfirmSubject(e.target.value)}
                    placeholder={DEFAULT_SIGNUP_CONFIRMATION_SUBJECT}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={9}
                    value={confirmBody}
                    onChange={(e) => setConfirmBody(e.target.value)}
                    placeholder={DEFAULT_SIGNUP_CONFIRMATION_BODY}
                  />
                </div>
                <VariableHelp tokens={["name", "group_name", "org_name", "email", "phone", "meeting_details"]} />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      patch({ signup_confirmation_subject: confirmSubject || null, signup_confirmation_body: confirmBody || null })
                    }
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirmSubject(DEFAULT_SIGNUP_CONFIRMATION_SUBJECT);
                      setConfirmBody(DEFAULT_SIGNUP_CONFIRMATION_BODY);
                    }}
                  >
                    Reset to default
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leader Notification Email</CardTitle>
                <CardDescription>Sent to the group's leaders and co-leaders when someone signs up.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Notify group leaders</Label>
                  <Switch
                    checked={s.leader_notification_enabled ?? true}
                    onCheckedChange={(v) => patch({ leader_notification_enabled: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={leaderSubject}
                    onChange={(e) => setLeaderSubject(e.target.value)}
                    placeholder={DEFAULT_LEADER_NOTIFICATION_SUBJECT}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={9}
                    value={leaderBody}
                    onChange={(e) => setLeaderBody(e.target.value)}
                    placeholder={DEFAULT_LEADER_NOTIFICATION_BODY}
                  />
                </div>
                <VariableHelp tokens={["name", "group_name", "org_name", "email", "phone", "meeting_details"]} />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      patch({ leader_notification_subject: leaderSubject || null, leader_notification_body: leaderBody || null })
                    }
                  >
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLeaderSubject(DEFAULT_LEADER_NOTIFICATION_SUBJECT);
                      setLeaderBody(DEFAULT_LEADER_NOTIFICATION_BODY);
                    }}
                  >
                    Reset to default
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reply-To Address</CardTitle>
                <CardDescription>Replies to these emails go here. Leave blank to use the default.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="email"
                  placeholder="groups@yourchurch.org"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
                <Button onClick={() => patch({ communication_reply_to: replyTo || null })}>Save</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>


      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingType?.id ? "Edit Group Type" : "New Group Type"}</DialogTitle></DialogHeader>
          {editingType && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={editingType.label} onChange={(e) => setEditingType({ ...editingType, label: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input type="color" value={editingType.color} onChange={(e) => setEditingType({ ...editingType, color: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Input value={editingType.icon} onChange={(e) => setEditingType({ ...editingType, icon: e.target.value })} placeholder="Users" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={editingType.is_active} onCheckedChange={(v) => setEditingType({ ...editingType, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveType} disabled={!editingType?.label}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupSettingsPage;
