
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Contact } from "@/types/crm";
import { hostTeamPipeline, pastoralCarePipeline } from "@/data/mockData";
import { toast } from "sonner";

const UserProfilePage = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  // Find the contact in any pipeline
  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => {
      // Search through all pipelines to find the contact
      const allContacts: Contact[] = [];
      
      // Add all contacts from all pipelines
      hostTeamPipeline.stages.forEach(stage => {
        allContacts.push(...stage.contacts);
      });
      pastoralCarePipeline.stages.forEach(stage => {
        allContacts.push(...stage.contacts);
      });
      
      const foundContact = allContacts.find(contact => contact.id === contactId);
      
      if (!foundContact) {
        throw new Error("Contact not found");
      }
      
      return foundContact;
    },
    meta: {
      onError: () => {
        toast.error("Contact not found");
        navigate(-1);
      }
    }
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mr-2"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Contact Profile</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex flex-col items-center">
              <Avatar className="h-24 w-24">
                {contact.avatar ? (
                  <img src={contact.avatar} alt={contact.name} className="rounded-full" />
                ) : (
                  <div className="bg-crm-primary text-white rounded-full w-full h-full flex items-center justify-center text-2xl">
                    {contact.name.charAt(0)}
                  </div>
                )}
              </Avatar>
              <h2 className="text-xl font-semibold mt-4">{contact.name}</h2>
              <p className="text-muted-foreground text-sm">{contact.status}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contact.email && (
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-500" />
                  <a 
                    href={`mailto:${contact.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              
              {contact.phone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-gray-500" />
                  <a 
                    href={`tel:${contact.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {contact.phone}
                  </a>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2 text-gray-500" />
                  <a 
                    href={`sms:${contact.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    Send message
                  </a>
                </div>
              )}
              
              {contact.tags && contact.tags.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className={`px-2 py-1 text-xs rounded-full
                          ${tag === 'active' ? 'bg-green-100 text-green-800' : ''}
                          ${tag === 'partner' ? 'bg-blue-100 text-blue-800' : ''}
                          ${tag === 'florida' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${tag === 'location' ? 'bg-purple-100 text-purple-800' : ''}
                        `}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {contact.assignedTo && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Assigned To</h3>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {contact.assignedTo.avatar ? (
                        <img src={contact.assignedTo.avatar} alt={contact.assignedTo.name} className="rounded-full" />
                      ) : (
                        <div className="bg-gray-300 text-white rounded-full w-full h-full flex items-center justify-center text-xs">
                          {contact.assignedTo.name.charAt(0)}
                        </div>
                      )}
                    </Avatar>
                    <span>{contact.assignedTo.name}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <h2 className="text-xl font-semibold">Contact Details</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Added on</h3>
                <p>{contact.date}</p>
              </div>
              
              {contact.notes && (
                <div>
                  <h3 className="text-sm font-medium mb-1">Notes</h3>
                  <p className="text-gray-600">{contact.notes}</p>
                </div>
              )}
              
              {/* Placeholder for history or additional information */}
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Activity History</h3>
                <p className="text-gray-500 text-sm italic">
                  No recent activities to display.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage;
