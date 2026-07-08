# Supabase Web Push Configuration Guide

This guide outlines the steps required on the Supabase side to enable background Web Push notifications for your iOS/Android Progressive Web App (PWA).

---

## 1. Database Table Configuration (SQL Editor)

Run the following SQL script in your **Supabase SQL Editor** to create the required database tables, add the timezone field, and enable Row Level Security (RLS):

```sql
-- 1. Create the schema if it doesn't exist
create schema if not exists record;

-- 2. Create the push subscriptions table inside the 'record' schema
create table record.push_subscriptions (
    id bigint generated always as identity primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    endpoint text unique not null,
    subscription jsonb not null,
    timezone text default 'UTC' not null,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. Create the blood sugar readings table inside the 'record' schema
create table record.blood_sugar_readings (
    id uuid primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    value numeric not null,
    unit text not null,
    context text not null,
    notes text,
    measured_at timestamptz not null,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4. Create the blood sugar alerts table inside the 'record' schema
create table record.blood_sugar_alerts (
    id uuid primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    type text not null,
    time text not null, -- formatted as "HH:MM"
    label text,
    is_active boolean default true not null,
    meal_type text,
    last_triggered_date text, -- formatted as "YYYY-MM-DD"
    frequency text default 'daily' not null,
    start_date text default to_char(now(), 'YYYY-MM-DD') not null,
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table record.push_subscriptions enable row level security;
alter table record.blood_sugar_readings enable row level security;
alter table record.blood_sugar_alerts enable row level security;

-- Create RLS Policies for push_subscriptions
create policy "Users can view their own push subscriptions"
on record.push_subscriptions for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert their own push subscriptions"
on record.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
on record.push_subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
on record.push_subscriptions for delete to authenticated using (auth.uid() = user_id);

-- Create RLS Policies for blood_sugar_readings
create policy "Users can view their own blood sugar readings"
on record.blood_sugar_readings for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert their own blood sugar readings"
on record.blood_sugar_readings for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own blood sugar readings"
on record.blood_sugar_readings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own blood sugar readings"
on record.blood_sugar_readings for delete to authenticated using (auth.uid() = user_id);

-- Create RLS Policies for blood_sugar_alerts
create policy "Users can view their own blood sugar alerts"
on record.blood_sugar_alerts for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert their own blood sugar alerts"
on record.blood_sugar_alerts for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own blood sugar alerts"
on record.blood_sugar_alerts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own blood sugar alerts"
on record.blood_sugar_alerts for delete to authenticated using (auth.uid() = user_id);
```

---

## 2. Supabase Secrets (Environment Variables)

To send notifications, your Supabase project needs to sign push payloads with your VAPID keys.

Configure them inside your **Supabase Dashboard** under **Settings > API > Secrets / Env Variables** or run these commands using the Supabase CLI:

```bash
VAPID_PUBLIC_KEY=BMW0eQ36Hgo0vulNeDSQUEmaNqNbxsX4-O1CWiRgfRCIYHtbMOx8Eg6jrYJnCw3oZNso2jmJ_s9_Q_lUbarxtD4
VAPID_PRIVATE_KEY=VIAm7ZTMnhxYgkdpCxFXdhEHNaJisL3Jm0GjX8nF1jQ
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 3. Deployment of the two Edge Functions

To support background alarms and browser closure alerts, you must create and deploy **two** Edge Functions.

### Function 1: `notify-closed`
Handles real-time beacon pings sent when the user closes the PWA.

Create a file `supabase/functions/notify-closed/index.ts` with:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error("Missing userId");

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'record' } }
    );

    const { data: subscriptions } = await supabaseClient
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions" }), { headers: corsHeaders });
    }

    const payload = JSON.stringify({
      title: "GlucoSync Alert",
      body: "You closed the app! Don't forget to keep logging your readings."
    });

    await Promise.all(subscriptions.map(sub => 
      webpush.sendNotification(sub.subscription, payload).catch(err => console.error(err))
    ));

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
```

Deploy it using:
```bash
supabase functions deploy notify-closed
```

---

### Function 2: `check-and-notify-alarms`
Scheduled by a cron job, it scans all active user alerts and compares them to local times based on the user's timezone.

Create a file `supabase/functions/check-and-notify-alarms/index.ts` with:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

serve(async (req) => {
  try {
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'record' } }
    );

    // Fetch all push subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('*');

    if (subError) throw subError;

    let totalSent = 0;

    for (const sub of subscriptions) {
      const { user_id, subscription: pushSub, timezone } = sub;

      // 1. Get current time formatted in user's timezone (safely falling back to Asia/Kolkata if missing/invalid)
      let localTime;
      try {
        localTime = new Date().toLocaleString("en-US", { timeZone: timezone || "Asia/Kolkata" });
      } catch (e) {
        console.warn(`Invalid timezone "${timezone}" for user ${user_id}. Falling back to Asia/Kolkata.`);
        localTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      }
      const localDateObj = new Date(localTime);
      
      const currentHHMM = localDateObj.toTimeString().slice(0, 5); // "HH:MM"
      const localTodayStr = localDateObj.toISOString().slice(0, 10); // "YYYY-MM-DD"

      // 2. Fetch active alerts that match this current local hour/minute
      const { data: alerts, error: alertError } = await supabaseClient
        .from('blood_sugar_alerts')
        .select('*')
        .eq('user_id', user_id)
        .eq('is_active', true)
        .eq('time', currentHHMM);

      if (alertError) {
        console.error(`Alert error for user ${user_id}:`, alertError);
        continue;
      }

      // Filter alerts not yet triggered today
      const pendingAlerts = alerts.filter(al => al.last_triggered_date !== localTodayStr);

      for (const al of pendingAlerts) {
        const payload = JSON.stringify({
          title: al.label || "GlucoSync Alarm",
          body: al.type === 'meal' 
            ? "Time for your post-meal glucose check-in." 
            : "It's time to log your daily blood sugar reading."
        });

        try {
          await webpush.sendNotification(pushSub, payload);
          totalSent++;

          // 3. Mark alert as triggered today in user local timezone
          await supabaseClient
            .from('blood_sugar_alerts')
            .update({ last_triggered_date: localTodayStr })
            .eq('id', al.id);

        } catch (pushErr) {
          console.error(`Failed to push notification to subscription ${sub.id}:`, pushErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notificationsSent: totalSent }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
```

Deploy it using:
```bash
supabase functions deploy check-and-notify-alarms
```

---

## 4. Scheduling Background Alarms (pg_cron)

To execute the `check-and-notify-alarms` function every minute:

1. Enable the `pg_cron` extension in your Supabase Dashboard (**Database > Extensions**).
2. Execute the following SQL query in the **SQL Editor** to schedule Deno invocation:

```sql
-- Schedule cron job to run every minute
select cron.schedule(
    'check-alarms-cron',
    '* * * * *', -- every minute
    $$ select net.http_post(
        url := 'https://jlegrmsylvnfscjwqtnn.supabase.co/functions/v1/check-and-notify-alarms',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body := '{}'::jsonb
    ) $$
);
```

> [!IMPORTANT]
> Replace `YOUR_SERVICE_ROLE_KEY` in the query above with the **service_role** API key (found under Settings > API in your Supabase dashboard). The service role key is required because pg_cron operates outside user contexts and needs service-level access to trigger Edge Functions securely.
