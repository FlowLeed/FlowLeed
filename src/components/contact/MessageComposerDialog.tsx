import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, MessageSquare, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface MessageComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  contactPhone?: string;
  suggestionContext: {
    type: string;
    title: string;
    description: string;
  };
  messageType: 'text' | 'email';
  currentPipelineId?: string;
}

export function MessageComposerDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  contactPhone,
  suggestionContext,
  messageType,
  currentPipelineId,
}: MessageComposerDialogProps) {
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [editedMessage, setEditedMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      generateMessage();
    } else {
      // Reset state when dialog closes
      setGeneratedMessage("");
      setEditedMessage("");
      setError(null);
    }
  }, [open]);

  const generateMessage = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-contact-message', {
        body: {
          contactId,
          messageType,
          suggestionContext
        }
      });

      if (error) throw error;

      if (data?.message) {
        setGeneratedMessage(data.message);
        setEditedMessage(data.message);
      } else {
        throw new Error('No message generated');
      }
    } catch (err) {
      console.error('Error generating message:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!editedMessage) return;

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(editedMessage);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Log to interaction history
      const { error: insertError } = await supabase
        .from('contact_interactions')
        .insert({
          contact_id: contactId,
          pipeline_id: currentPipelineId,
          interaction_type: 'text',
          subject: suggestionContext.title,
          details: editedMessage,
          completed_at: new Date().toISOString(),
          created_by_user_id: user.id,
          metadata: {
            ai_generated: true,
            suggestion_type: suggestionContext.type,
            message_type: messageType,
            copied_at: new Date().toISOString()
          }
        });

      if (insertError) throw insertError;

      // Invalidate queries to refresh the timeline
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });

      toast({
        title: "Success!",
        description: "Message copied and logged to interaction history",
      });

      onOpenChange(false);
    } catch (err) {
      console.error('Error:', err);
      toast({
        title: "Partial Success",
        description: "Message copied but failed to log to history",
        variant: "destructive",
      });
    }
  };

  const characterCount = editedMessage.length;
  const showNoPhoneWarning = messageType === 'text' && !contactPhone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {suggestionContext.title}
          </DialogTitle>
          <DialogDescription>
            AI-generated message for {contactName}. Review and edit as needed before copying.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showNoPhoneWarning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <strong>No phone number on file.</strong> Add a phone number to this contact to use this feature effectively.
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : error ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm text-destructive">
                  {error}
                </div>
              </div>
              <Button onClick={generateMessage} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Message</label>
                  <Badge variant="secondary" className="text-xs">
                    {characterCount} characters
                  </Badge>
                </div>
                <Textarea
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  placeholder="Your message will appear here..."
                  className="min-h-[150px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {messageType === 'text' 
                    ? "Most SMS messages are ~160 characters, but longer messages work fine on modern phones."
                    : "Edit the message above to personalize it before copying."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCopyMessage}
                  disabled={!editedMessage}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Message
                </Button>
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Message will be logged to interaction history when copied
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
