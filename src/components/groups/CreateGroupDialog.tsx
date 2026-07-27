import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useGroups } from "@/hooks/useGroups";
import { GroupImageUpload } from "./GroupImageUpload";
import { LeaderSelector } from "./LeaderSelector";
import { useGroupTypes } from "@/hooks/useGroupTypes";
import { useGroupSettings } from "@/hooks/useGroupSettings";
import { useEffect } from "react";

const groupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  group_type: z.string().min(1),
  meeting_day: z.string().optional(),
  meeting_time: z.string().optional(),
  meeting_frequency: z.string().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | undefined;
}

export const CreateGroupDialog = ({
  open,
  onOpenChange,
  organizationId,
}: CreateGroupDialogProps) => {
  const { createGroup } = useGroups(organizationId);
  const { types: groupTypes } = useGroupTypes(organizationId);
  const { settings } = useGroupSettings(organizationId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [leaderUserId, setLeaderUserId] = useState<string | null>(null);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      description: "",
      group_type: "small_group",
      meeting_frequency: "weekly",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        description: "",
        group_type: groupTypes[0]?.key || "small_group",
        meeting_frequency: settings?.default_meeting_frequency || "weekly",
        capacity: settings?.default_capacity ?? undefined,
      } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupTypes.length, settings?.default_meeting_frequency, settings?.default_capacity]);

  const onSubmit = async (values: GroupFormValues) => {
    if (!organizationId) return;

    setIsSubmitting(true);
    try {
      await createGroup.mutateAsync({
        name: values.name,
        description: values.description,
        group_type: values.group_type,
        meeting_day: values.meeting_day,
        meeting_time: values.meeting_time,
        meeting_frequency: values.meeting_frequency,
        location: values.location,
        capacity: values.capacity,
        organization_id: organizationId,
        status: "active",
        image_url: imageUrl,
        leader_user_id: leaderUserId,
      });
      form.reset();
      setImageUrl(null);
      setLeaderUserId(null);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedName = form.watch("name");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <GroupImageUpload
              groupName={watchedName}
              currentImageUrl={imageUrl}
              onImageChange={setImageUrl}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Life Together Small Group" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="group_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupTypes.map((t) => (
                        <SelectItem key={t.id} value={t.key}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us about this group..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="meeting_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Day</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Monday">Monday</SelectItem>
                        <SelectItem value="Tuesday">Tuesday</SelectItem>
                        <SelectItem value="Wednesday">Wednesday</SelectItem>
                        <SelectItem value="Thursday">Thursday</SelectItem>
                        <SelectItem value="Friday">Friday</SelectItem>
                        <SelectItem value="Saturday">Saturday</SelectItem>
                        <SelectItem value="Sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meeting_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="meeting_frequency"
                render={({ field }) => {
                  const presets = ["weekly", "biweekly", "monthly"];
                  const isCustom = customFrequency || !!(field.value && !presets.includes(field.value));
                  return (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select
                        value={isCustom ? "__custom__" : field.value}
                        onValueChange={(v) => {
                          if (v === "__custom__") {
                            setCustomFrequency(true);
                            field.onChange("");
                          } else {
                            setCustomFrequency(false);
                            field.onChange(v);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="__custom__">Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustom && (
                        <Input
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="e.g. 1st & 3rd Tuesday"
                        />
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />


              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St or Room 201" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {organizationId && (
              <LeaderSelector
                organizationId={organizationId}
                value={leaderUserId}
                onChange={setLeaderUserId}
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
