import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MapPin, User, Users, Building2 } from 'lucide-react';

interface Demographics {
  birthday?: string;
  marital_status?: string;
  occupation?: string;
}

interface Address {
  id: string;
  address_type: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  is_primary: boolean;
}

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  birthday?: string;
  avatar?: string;
  is_child?: boolean;
}

interface ContactDemographicsProps {
  demographics?: Demographics;
  addresses: Address[];
  familyMembers: FamilyMember[];
  campusName?: string;
}

export const ContactDemographics: React.FC<ContactDemographicsProps> = ({
  demographics,
  addresses,
  familyMembers,
  campusName
}) => {
  const primaryAddress = addresses.find(addr => addr.is_primary) || addresses[0];
  
  const formatAge = (birthday?: string) => {
    if (!birthday) return null;
    const today = new Date();
    const birthDate = new Date(birthday);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    return age;
  };

  return (
    <div className="space-y-6">
      {/* Demographics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Demographics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {demographics?.birthday && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Birthday</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(demographics.birthday).toLocaleDateString()} 
                  {formatAge(demographics.birthday) && ` (${formatAge(demographics.birthday)} years old)`}
                </p>
              </div>
            </div>
          )}
          
          {demographics?.marital_status && (
            <div>
              <p className="text-sm font-medium mb-1">Marital Status</p>
              <Badge variant="secondary">{demographics.marital_status}</Badge>
            </div>
          )}
          
          {demographics?.occupation && (
            <div>
              <p className="text-sm font-medium">Occupation</p>
              <p className="text-sm text-muted-foreground">{demographics.occupation}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address */}
      {primaryAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {primaryAddress.street_address && (
                <p className="text-sm">{primaryAddress.street_address}</p>
              )}
              {(primaryAddress.city || primaryAddress.state || primaryAddress.zip_code) && (
                <p className="text-sm text-muted-foreground">
                  {[primaryAddress.city, primaryAddress.state, primaryAddress.zip_code]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              <Badge variant="outline" className="text-xs">
                {primaryAddress.address_type}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Family Members */}
      {familyMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Family
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {familyMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>
                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.relationship}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {member.birthday && formatAge(member.birthday) !== null && (
                      <p className="text-xs text-muted-foreground">
                        {formatAge(member.birthday)} yrs
                      </p>
                    )}
                    <Badge 
                      variant={member.is_child ? "default" : "secondary"} 
                      className="text-xs"
                    >
                      {member.is_child ? "Child" : "Adult"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};