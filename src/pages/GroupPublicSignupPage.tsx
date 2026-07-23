import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Calendar, Clock, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";

interface GroupDetails {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  meeting_day: string | null;
  meeting_time: string | null;
  meeting_frequency: string | null;
  location: string | null;
  capacity: number | null;
  member_count: number;
  is_full: boolean;
  image_url: string | null;
  allow_public_signup: boolean;
}

const groupTypeLabels: Record<string, string> = {
  small_group: "Small Group",
  life_group: "Life Group",
  bible_study: "Bible Study",
  ministry_team: "Ministry Team",
  class: "Class",
  support_group: "Support Group",
  other: "Other",
};

const formatDescription = (description: string | null) => {
  if (!description) return null;

  return description
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
};

export default function GroupPublicSignupPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const fromSlug = searchParams.get("from");
  const backHref = fromSlug ? `/${fromSlug}/groups` : "/groups/directory";
  const backLabel = fromSlug ? "Back to Groups" : "Browse All Groups";
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    const fetchGroup = async () => {
      if (!token) {
        setError("Invalid signup link");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `https://lghamvpolwebtjwaxned.supabase.co/functions/v1/group-public-signup?token=${token}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || "Group not found");
          return;
        }

        setGroup(result.group);
      } catch (err) {
        console.error("Error fetching group:", err);
        setError("Failed to load group details");
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formData.name || !formData.email) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        `https://lghamvpolwebtjwaxned.supabase.co/functions/v1/group-public-signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to submit signup");
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting signup:", err);
      setError("Failed to submit signup request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen overflow-y-auto bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="h-screen overflow-y-auto bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Group</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="h-screen overflow-y-auto bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Request Submitted!</h2>
            <p className="text-muted-foreground mb-4">
              Your signup request for <strong>{group?.name}</strong> has been submitted.
              A group leader will review it shortly.
            </p>
            <Button variant="outline" asChild>
              <Link to="/groups/directory">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Browse More Groups
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="h-screen overflow-y-auto bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <Button variant="ghost" asChild className="mb-2">
          <Link to="/groups/directory">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Browse All Groups
          </Link>
        </Button>
        <Card className="overflow-hidden">
          {/* Wide image/avatar banner */}
          <div className="w-full h-40 bg-muted flex items-center justify-center">
            {group.image_url ? (
              <img 
                src={group.image_url} 
                alt={group.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl font-semibold text-muted-foreground">
                {group.name.trim().split(/\s+/).length >= 2
                  ? (group.name.trim().split(/\s+/)[0][0] + group.name.trim().split(/\s+/)[1][0]).toUpperCase()
                  : group.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">
                {groupTypeLabels[group.group_type] || group.group_type}
              </Badge>
              {group.is_full && (
                <Badge variant="destructive">Full</Badge>
              )}
            </div>
            <CardTitle className="text-2xl">{group.name}</CardTitle>
            {group.description && (
              <CardDescription className="text-base mt-1">
                {formatDescription(group.description)}
              </CardDescription>
            )}
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Group Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {group.meeting_day && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{group.meeting_day}{group.meeting_frequency && ` (${group.meeting_frequency})`}</span>
              </div>
            )}
            {group.meeting_time && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{group.meeting_time}</span>
              </div>
            )}
            {group.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{group.location}</span>
              </div>
            )}
          </div>

          {/* Signup Form */}
          {!group.allow_public_signup ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                Contact the church to join this group.
              </p>
            </div>
          ) : group.is_full ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                This group is currently full. Please check back later or contact the group leader.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Request to Join"}
              </Button>
            </form>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
