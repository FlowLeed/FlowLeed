# Recurring Flows Feature

## Overview
Recurring flows allow you to keep ongoing relationships active by automatically cycling contacts back to the start of a flow after a specified period.

## How It Works

### Flow Types
1. **Linear Flow** (default): Contacts move through stages and complete. Once they reach the end, they stay there.
2. **Recurring Flow**: Contacts cycle back to the first step after spending a set amount of time in the final step.

### Creating a Recurring Flow
1. Open "Create Flow" or edit an existing flow in Flow Settings
2. Select "Recurring Flow" as the Flow Type
3. Choose the Cycle Duration (15, 30, 60, 90, 120, or 180 days)
4. Configure your stages as usual

### Automatic Cycling
The `recurring-flow-processor` edge function runs daily to:
- Find all recurring flows
- Identify contacts who have been in the final step longer than the cycle duration
- Move them back to the first step
- Create an interaction record tracking the cycle restart

### Examples of Recurring Flows
- Recurring Givers: Check in every 90 days
- Volunteers: Re-engage every 60 days
- Small Group Members: Follow up every 30 days
- Dream Team: Quarterly touchpoints (90 days)

## Setting Up the Cron Job

To enable automatic processing, you need to set up a daily cron job in your Supabase database.

### Manual Setup (Required)

Run the following SQL in your Supabase SQL Editor:

\`\`\`sql
SELECT cron.schedule(
  'recurring-flow-processor',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://lghamvpolwebtjwaxned.supabase.co/functions/v1/recurring-flow-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
\`\`\`

**Note:** Replace `YOUR_ANON_KEY` with your actual Supabase anon key from the config.

### Verifying the Cron Job

Check if the cron job is scheduled:
\`\`\`sql
SELECT * FROM cron.job WHERE jobname = 'recurring-flow-processor';
\`\`\`

### Manual Testing

You can manually trigger the processor to test it:
1. Go to Supabase Dashboard > Edge Functions
2. Find `recurring-flow-processor`
3. Click "Invoke" with an empty body `{}`

Or call it via the Supabase client:
\`\`\`typescript
await supabase.functions.invoke('recurring-flow-processor');
\`\`\`

## Interaction Types

The recurring flow processor creates interactions with type `cycle_restart` that include:
- Which flow the contact cycled in
- Previous stage (end step)
- New stage (start step)
- Number of cycle days configured

These appear in the contact's timeline.
