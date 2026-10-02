import { createClient } from "@supabase/supabase-js";
import { rejectUnlessCron } from "../_shared/cron-auth.ts";
import { Resend } from "resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationWithDetails {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  contact_id: string | null;
  pipeline_id: string | null;
  contacts: { name: string } | null;
  pipelines: { name: string } | null;
}

interface UserWithPreferences {
  user_id: string;
  full_name: string | null;
  notification_preferences: {
    email_digest_enabled?: boolean;
  } | null;
}

function generateDigestHTML(
  notifications: NotificationWithDetails[],
  userName: string,
  appUrl: string
): string {
  // Group notifications by pipeline
  const byPipeline: Record<string, NotificationWithDetails[]> = {};
  
  for (const notification of notifications) {
    const pipelineName = notification.pipelines?.name || "Other";
    if (!byPipeline[pipelineName]) {
      byPipeline[pipelineName] = [];
    }
    byPipeline[pipelineName].push(notification);
  }

  const pipelineSections = Object.entries(byPipeline)
    .map(([pipelineName, pipelineNotifications]) => {
      const items = pipelineNotifications
        .map((n) => {
          const contactName = n.contacts?.name || "Unknown";
          const timeAgo = getTimeAgo(new Date(n.created_at));
          return `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="font-weight: 500; color: #111827;">${contactName}</span>
                <br>
                <span style="font-size: 12px; color: #6b7280;">${timeAgo}</span>
              </td>
            </tr>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">
            ${pipelineName}
          </h3>
          <table style="width: 100%;">
            ${items}
          </table>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Assignment Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background-color: #2563eb; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
        🔔 Daily Assignment Digest
      </h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 24px;">
      <p style="margin: 0 0 8px 0; color: #374151; font-size: 16px;">
        Hi ${userName || "there"},
      </p>
      <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">
        You have <strong style="color: #111827;">${notifications.length} new ${notifications.length === 1 ? "person" : "people"}</strong> assigned to you.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      
      ${pipelineSections}
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      
      <!-- CTA -->
      <div style="text-align: center;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View All in Flowleed →
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        <a href="${appUrl}/profile" style="color: #2563eb; text-decoration: none;">Manage notification preferences</a>
      </p>
      <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px;">
        You're receiving this because email digests are enabled in your Flowleed settings.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours === 1) {
    return "1 hour ago";
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const unauthorized = rejectUnlessCron(req, corsHeaders);
  if (unauthorized) return unauthorized;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = "https://flow-follow-up-friend.lovable.app";

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    console.log("Starting daily digest processing...");

    // Get all users who have email digest enabled
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("user_id, full_name, notification_preferences")
      .not("notification_preferences", "is", null);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} users with notification preferences`);

    // Filter users who have digest enabled (default is true if not explicitly set)
    const eligibleUsers = (users || []).filter((user: UserWithPreferences) => {
      const prefs = user.notification_preferences;
      // If email_digest_enabled is not explicitly set to false, assume true (opt-out model)
      return prefs?.email_digest_enabled !== false;
    });

    console.log(`${eligibleUsers.length} users have email digest enabled`);

    let emailsSent = 0;
    let usersSkipped = 0;
    const errors: string[] = [];

    // People in an active life season (sick, new baby, deployed, ...) are left out of digests.
    const { data: activeSeasons } = await supabase
      .from("contact_life_seasons")
      .select("contact_id")
      .is("ended_on", null);
    const pausedContactIds = new Set((activeSeasons ?? []).map((s: { contact_id: string }) => s.contact_id));
    console.log(`${pausedContactIds.size} people are paused and will be skipped`);


    for (const user of eligibleUsers) {
      try {
        // Get user's email from auth.users
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.user_id);
        
        if (authError || !authUser?.user?.email) {
          console.log(`Skipping user ${user.user_id}: no email found`);
          usersSkipped++;
          continue;
        }

        const userEmail = authUser.user.email;

        // Get unsent assignment notifications for this user
        const { data: notifications, error: notifError } = await supabase
          .from("notifications")
          .select(`
            id,
            title,
            message,
            type,
            created_at,
            contact_id,
            pipeline_id,
            contacts (name),
            pipelines (name)
          `)
          .eq("user_id", user.user_id)
          .eq("email_digest_sent", false)
          .in("type", ["person_assigned", "person_unassigned"])
          .order("created_at", { ascending: false });

        if (notifError) {
          console.error(`Error fetching notifications for user ${user.user_id}:`, notifError);
          errors.push(`User ${user.user_id}: ${notifError.message}`);
          continue;
        }

        if (!notifications || notifications.length === 0) {
          console.log(`No pending notifications for user ${user.user_id}`);
          usersSkipped++;
          continue;
        }

        // Leave out people whose engagement is paused for a life season
        const visibleNotifications = notifications.filter(
          (n) => !n.contact_id || !pausedContactIds.has(n.contact_id)
        );
        const notificationIdsToMark = notifications.map((n) => n.id);

        if (visibleNotifications.length === 0) {
          console.log(`All notifications for user ${user.user_id} belong to paused people`);
          await supabase
            .from("notifications")
            .update({
              email_digest_sent: true,
              email_digest_sent_at: new Date().toISOString(),
            })
            .in("id", notificationIdsToMark);
          usersSkipped++;
          continue;
        }

        console.log(`Sending digest with ${visibleNotifications.length} notifications to ${userEmail}`);

        // Generate and send email
        const html = generateDigestHTML(
          visibleNotifications as NotificationWithDetails[],
          user.full_name || "",
          appUrl
        );

        const emailResponse = await resend.emails.send({
          from: "Flowleed <noreply@flowleed.com>",
          to: [userEmail],
          subject: `Daily Assignment Digest: ${visibleNotifications.length} new ${visibleNotifications.length === 1 ? "assignment" : "assignments"}`,
          html,
        });

        console.log(`Email sent to ${userEmail}:`, emailResponse);

        // Mark notifications as sent
        const { error: updateError } = await supabase
          .from("notifications")
          .update({
            email_digest_sent: true,
            email_digest_sent_at: new Date().toISOString(),
          })
          .in("id", notificationIdsToMark);

        if (updateError) {
          console.error(`Error marking notifications as sent:`, updateError);
          errors.push(`Failed to update notifications for user ${user.user_id}`);
        } else {
          emailsSent++;
        }
      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
        errors.push(`User ${user.user_id}: ${String(userError)}`);
      }
    }

    const result = {
      success: true,
      summary: {
        totalUsers: eligibleUsers.length,
        emailsSent,
        usersSkipped,
        errors: errors.length,
      },
      errorDetails: errors.length > 0 ? errors : undefined,
    };

    console.log("Daily digest processing complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in send-daily-digest function:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
