import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTwilioNumbers, TwilioPhoneNumber } from '@/hooks/useTwilioNumbers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, MessageSquare, Image, UserCheck, UserX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface OrganizationPhoneNumbersProps {
  organizationId: string;
}

interface OrgMember {
  id: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}

export function OrganizationPhoneNumbers({ organizationId }: OrganizationPhoneNumbersProps) {
  const { numbers, isLoading: numbersLoading, assignNumber } = useTwilioNumbers();
  const [assigningNumberId, setAssigningNumberId] = useState<string | null>(null);

  // Fetch organization members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['org-members', organizationId],
    queryFn: async () => {
      const { data: orgMembers, error: orgError } = await supabase
        .from('organization_members')
        .select('id, user_id')
        .eq('organization_id', organizationId);

      if (orgError) throw orgError;

      // Fetch profiles separately
      const userIds = orgMembers.map(m => m.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (profileError) throw profileError;

      // Merge the data
      return orgMembers.map(member => ({
        id: member.id,
        user_id: member.user_id,
        profiles: profiles?.find(p => p.user_id === member.user_id) || null
      }));
    },
  });

  // Filter numbers for this organization
  const orgNumbers = numbers.filter(n => n.organization_id === organizationId);

  const handleAssignNumber = async (phoneNumberId: string, userId: string | null) => {
    setAssigningNumberId(phoneNumberId);
    try {
      await assignNumber.mutateAsync({ phoneNumberId, userId });
    } finally {
      setAssigningNumberId(null);
    }
  };

  const getMemberName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const member = members.find(m => m.user_id === userId);
    return member?.profiles?.full_name || member?.profiles?.email || 'Unknown User';
  };

  if (numbersLoading || membersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orgNumbers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No phone numbers provisioned for this organization
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Phone Numbers ({orgNumbers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orgNumbers.map((number) => (
            <div
              key={number.id}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-semibold">
                    {number.phone_number}
                  </span>
                  {number.is_primary && (
                    <Badge variant="default">Primary</Badge>
                  )}
                  {number.friendly_name && (
                    <span className="text-sm text-muted-foreground">
                      {number.friendly_name}
                    </span>
                  )}
                </div>

                {/* Capabilities */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Capabilities:</span>
                  {number.capabilities.voice && (
                    <Badge variant="outline" className="gap-1">
                      <Phone className="h-3 w-3" />
                      Voice
                    </Badge>
                  )}
                  {number.capabilities.sms && (
                    <Badge variant="outline" className="gap-1">
                      <MessageSquare className="h-3 w-3" />
                      SMS
                    </Badge>
                  )}
                  {number.capabilities.mms && (
                    <Badge variant="outline" className="gap-1">
                      <Image className="h-3 w-3" />
                      MMS
                    </Badge>
                  )}
                </div>

                {/* Assignment Status */}
                <div className="flex items-center gap-2">
                  {number.assigned_to_user_id ? (
                    <div className="flex items-center gap-2 text-sm">
                      <UserCheck className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">Assigned to:</span>
                      <span className="font-medium">
                        {getMemberName(number.assigned_to_user_id)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UserX className="h-4 w-4" />
                      <span>Available (Organization-level)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Control */}
              <div className="ml-4">
                <Select
                  value={number.assigned_to_user_id || 'unassigned'}
                  onValueChange={(value) => {
                    const userId = value === 'unassigned' ? null : value;
                    handleAssignNumber(number.id, userId);
                  }}
                  disabled={assigningNumberId === number.id}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4" />
                        <span>Unassigned</span>
                      </div>
                    </SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles?.full_name || member.profiles?.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
