# Supabase Web Push Configuration Guide

This guide outlines the steps required on the Supabase side to enable background Web Push notifications for your iOS/Android Progressive Web App (PWA).

---

## 1. Database Table Configuration (SQL Editor)

Run the following SQL script in your **Supabase SQL Editor** to create the subscription database table and enable Row Level Security (RLS):

```sql
-- 1. Create the push subscriptions table inside the 'record' schema
create table record.push_subscriptions (
    id bigint generated always as identity primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    endpoint text unique not null,
    subscription jsonb not null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security
alter table record.push_subscriptions enable row level security;

-- 3. Create RLS Policies to restrict access to authenticated users
create policy "Users can view their own push subscriptions"
on record.push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own push subscriptions"
on record.push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
on record.push_subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
on record.push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);
```

---

## 2. Supabase Secrets (Environment Variables)

To send notifications, your Supabase project needs to sign push payloads with your VAPID keys.

Run the following commands using the **Supabase CLI** or configure them inside your **Supabase Dashboard** (Settings > API > Secrets / Env Variables):

```bash
# Add these environment variables/secrets to your Supabase project
VAPID_PUBLIC_KEY=BMW0eQ36Hgo0vulNeDSQUEmaNqNbxsX4-O1CWiRgfRCIYHtbMOx8Eg6jrYJnCw3oZNso2jmJ_s9_Q_lUbarxtD4
VAPID_PRIVATE_KEY=VIAm7ZTMnhxYgkdpCxFXdhEHNaJisL3Jm0GjX8nF1jQ
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 3. Create the `notify-closed` Edge Function

Create a Supabase Edge Function to handle incoming browser-closure signals and send the push notification.

### Edge Function Code (`index.ts`)

Create a folder structure on your local machine under `supabase/functions/notify-closed/index.ts` with the following code:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Configure Web Push VAPID keys
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    // Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'record' } }
    );

    // Fetch user's registered push subscriptions
    const { data: subscriptions, error } = await supabaseClient
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions for user" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Send push notification to all user's registered devices
    const notificationPayload = JSON.stringify({
      title: "GlucoSync Reminder",
      body: "You closed the app! Don't forget to keep logging your readings."
    });

    const sendPromises = subscriptions.map((subRow: any) =>
      webpush.sendNotification(subRow.subscription, notificationPayload).catch((err: any) => {
        console.error("Error sending to a subscription endpoint:", err);
      })
    );

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, sentCount: subscriptions.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

### Deploying the Edge Function

Run the following command in your terminal to deploy this function directly to your Supabase project:

```bash
supabase functions deploy notify-closed
```

---

## 4. Scheduling Background Alarms (Optional / Recommended)

To replace the client-side `setInterval` for notifications when the app is closed, you can set up a scheduled background cron job in Supabase to run every minute:

1. Enable the `pg_cron` extension in your Supabase project (Settings > Database > Extensions).
2. Run the following SQL to schedule a cron job that checks for reminders and calls an edge function to push to the client:

```sql
-- Schedule a cron job to call your checker function every minute
select cron.schedule(
    'check-alarms-cron',
    '* * * * *',
    $$ select net.http_post(
        url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/check-and-notify-alarms',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body := '{}'::jsonb
    ) $$
);
```
