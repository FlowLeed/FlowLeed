import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  primary_contact_name: z.string().optional(),
  primary_contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  primary_contact_phone: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentData: {
    name: string;
    primary_contact_name?: string | null;
    primary_contact_email?: string | null;
    primary_contact_phone?: string | null;
  };
  onSuccess: () => void;
}

export function EditOrganizationDialog({
  open,
  onOpenChange,
  organizationId,
  currentData,
  onSuccess,
}: EditOrganizationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: currentData.name,
      primary_contact_name: currentData.primary_contact_name || '',
      primary_contact_email: currentData.primary_contact_email || '',
      primary_contact_phone: currentData.primary_contact_phone || '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: data.name,
          primary_contact_name: data.primary_contact_name || null,
          primary_contact_email: data.primary_contact_email || null,
          primary_contact_phone: data.primary_contact_phone || null,
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Organization updated successfully',
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to update organization',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Church Name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_contact_name">Admin Name</Label>
            <Input
              id="primary_contact_name"
              {...form.register('primary_contact_name')}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_contact_email">Admin Email</Label>
            <Input
              id="primary_contact_email"
              type="email"
              {...form.register('primary_contact_email')}
              placeholder="admin@church.org"
            />
            {form.formState.errors.primary_contact_email && (
              <p className="text-sm text-destructive">{form.formState.errors.primary_contact_email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_contact_phone">Admin Phone</Label>
            <Input
              id="primary_contact_phone"
              type="tel"
              {...form.register('primary_contact_phone')}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
