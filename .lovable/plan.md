

## Daily Email Digest for Assignment Notifications

### Overview
Add a daily email digest feature that sends users a summary of all people assigned to them in the past 24 hours. This will complement the existing in-app notifications.

### Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Daily Email Digest System                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────┐        │
│  │   pg_cron    │───►│ send-daily-digest│───►│  Resend API         │        │
│  │  (8 AM UTC)  │    │  Edge Function   │    │  (flowleed.com)     │        │
│  └──────────────┘    └────────┬─────────┘    └─────────────────────┘        │
│                               │                                              │
│                               ▼                                              │
│                    ┌──────────────────────┐                                  │
│                    │   notifications      │                                  │
│                    │  + email_digest_sent │                                  │
│                    └──────────────────────┘                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    User Preferences                                 │     │
│  │  profiles.notification_preferences: {                               │     │
│  │    email_digest_enabled: true,                                      │     │
│  │    email_digest_time: "08:00"                                       │     │
│  │  }                                                                  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### 1. Database Changes

**Add notification preferences to profiles table:**
```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb 
DEFAULT '{"email_digest_enabled": true}'::jsonb;
```

**Add tracking column to notifications table:**
```sql
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS email_digest_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_digest_sent_at timestamptz;
```

#### 2. Create Edge Function: `send-daily-digest`

**File: `supabase/functions/send-daily-digest/index.ts`**

The function will:
1. Query all users with `email_digest_enabled: true`
2. For each user, get unread `person_assigned` notifications not yet sent in a digest
3. Group notifications by user and generate HTML email with the digest
4. Send via Resend API
5. Mark notifications as `email_digest_sent = true`

```typescript
// Key logic pseudocode
const usersWithDigest = await supabase
  .from('profiles')
  .select('user_id, email, full_name, notification_preferences')
  .filter('notification_preferences->email_digest_enabled', 'eq', true);

for (const user of usersWithDigest) {
  const { data: unsentNotifications } = await supabase
    .from('notifications')
    .select('*, contacts(name), pipelines(name)')
    .eq('user_id', user.user_id)
    .eq('email_digest_sent', false)
    .in('type', ['person_assigned', 'person_unassigned'])
    .order('created_at', { ascending: false });

  if (unsentNotifications?.length > 0) {
    // Generate and send digest email
    await resend.emails.send({
      from: 'Flowleed <noreply@flowleed.com>',
      to: [user.email],
      subject: `Daily Assignment Digest: ${count} new assignments`,
      html: generateDigestHTML(unsentNotifications)
    });

    // Mark as sent
    await supabase
      .from('notifications')
      .update({ email_digest_sent: true, email_digest_sent_at: new Date() })
      .in('id', unsentNotifications.map(n => n.id));
  }
}
```

#### 3. Set Up Cron Job

**Using pg_cron to run daily at 8 AM UTC:**
```sql
SELECT cron.schedule(
  'send-daily-digest',
  '0 8 * * *', -- 8 AM UTC daily
  $$
  SELECT net.http_post(
    url:='https://lghamvpolwebtjwaxned.supabase.co/functions/v1/send-daily-digest',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

#### 4. Add User Preference UI

**Modify: `src/components/profile/NotificationSettings.tsx`** (new file)

Add a settings section where users can:
- Toggle email digest on/off
- (Future: Select preferred digest time)

#### 5. Update Config

**File: `supabase/config.toml`**
```toml
[functions.send-daily-digest]
verify_jwt = false
```

### Email Template Design

The digest email will include:
- Header with Flowleed branding
- Summary count ("You have 5 new assignments")
- Table of assignments grouped by flow:
  - Contact name (linked to profile)
  - Flow name
  - Stage name
  - When assigned
- Footer with unsubscribe link (toggles the preference)

```html
<!-- Email preview -->
Subject: Daily Assignment Digest: 5 new assignments

┌─────────────────────────────────────────────┐
│  🔔 Daily Assignment Digest                 │
│                                             │
│  You have 5 new people assigned to you      │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  NEW GUEST FOLLOW-UP                        │
│  ├─ John Smith - Welcome Call              │
│  ├─ Mary Johnson - Thank You Text          │
│  └─ Bob Williams - Follow Up               │
│                                             │
│  BAPTISM                                    │
│  ├─ Sarah Davis - Interest                 │
│  └─ Mike Brown - Info Sent                 │
│                                             │
│  [View All in Flowleed →]                   │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Manage notification preferences            │
└─────────────────────────────────────────────┘
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/send-daily-digest/index.ts` | Create | Edge function to send digest emails |
| `src/pages/ProfilePage.tsx` | Modify | Add notification preferences section |
| `supabase/config.toml` | Modify | Add function config |
| SQL Migration | Create | Add preference columns to profiles and tracking to notifications |

### Technical Considerations

1. **Rate Limiting**: Resend has rate limits; the function processes users sequentially to avoid hitting limits
2. **Time Zones**: Initially UTC-based; future enhancement could respect user time zones
3. **Empty Digests**: Skip users with no new notifications (no email sent)
4. **Retry Logic**: Failed emails are logged but don't block other users
5. **Opt-out by Default**: Users start with digest enabled but can disable in settings

### Security

- Edge function uses `SERVICE_ROLE_KEY` to query across users
- JWT verification disabled since it's called by cron (internal)
- Resend API key stored in Supabase secrets (already configured ✓)

