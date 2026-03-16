import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ReminderRow = {
  id: string;
  workflow_id: string;
  site_id: string;
  due_at: string;
};

type WorkflowRow = {
  id: string;
  item_name: string;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  site_id: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSecret(req: Request) {
  return req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

async function sendPushNotifications({
  supabase,
  reminders,
  workflows,
  subscriptions,
}: {
  supabase: ReturnType<typeof createClient>;
  reminders: ReminderRow[];
  workflows: WorkflowRow[];
  subscriptions: PushSubscriptionRow[];
}) {
  const publicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY");
  const privateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("WEB_PUSH_SUBJECT") || "mailto:ops@chefvoice.app";
  if (!publicKey || !privateKey || subscriptions.length === 0) return { sent: 0, removed: 0 };

  webpush.setVapidDetails(vapidSubject, publicKey, privateKey);

  const workflowMap = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  const deadEndpoints = new Set<string>();
  let sent = 0;

  await Promise.all(
    reminders.flatMap((reminder) => {
      const workflow = workflowMap.get(reminder.workflow_id);
      const title = "ChefVoice HACCP Reminder";
      const body = `${workflow?.item_name || "Hot hold item"} is due for a hot hold check.`;

      return subscriptions
        .filter((subscription) => subscription.site_id === reminder.site_id)
        .map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              JSON.stringify({
                title,
                body,
                url: "/",
                reminderId: reminder.id,
                workflowId: reminder.workflow_id,
              }),
            );
            sent += 1;
          } catch (error) {
            const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
            if (statusCode === 404 || statusCode === 410) {
              deadEndpoints.add(subscription.endpoint);
            } else {
              console.error("[haccp-reminders] push send failed", error);
            }
          }
        });
    }),
  );

  if (deadEndpoints.size > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", [...deadEndpoints]);
  }

  return { sent, removed: deadEndpoints.size };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && getSecret(req) !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase service role is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();

  const { data: reminders, error: reminderError } = await supabase
    .from("haccp_reminders")
    .select("id, workflow_id, site_id, due_at")
    .eq("delivery_state", "scheduled")
    .lte("due_at", nowIso);

  if (reminderError) {
    console.error("[haccp-reminders] failed to query reminders", reminderError);
    return jsonResponse({ error: reminderError.message }, 500);
  }

  const dueReminders = (reminders || []) as ReminderRow[];
  if (dueReminders.length === 0) {
    return jsonResponse({ processed: 0, pushed: 0, removedSubscriptions: 0 });
  }

  const reminderIds = dueReminders.map((reminder) => reminder.id);
  const workflowIds = [...new Set(dueReminders.map((reminder) => reminder.workflow_id))];
  const siteIds = [...new Set(dueReminders.map((reminder) => reminder.site_id))];

  const { error: updateError } = await supabase
    .from("haccp_reminders")
    .update({ delivery_state: "due" })
    .in("id", reminderIds)
    .eq("delivery_state", "scheduled");

  if (updateError) {
    console.error("[haccp-reminders] failed to mark reminders due", updateError);
    return jsonResponse({ error: updateError.message }, 500);
  }

  const [{ data: workflows, error: workflowError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    supabase.from("haccp_workflows").select("id, item_name").in("id", workflowIds),
    supabase.from("push_subscriptions").select("endpoint, p256dh, auth, site_id").in("site_id", siteIds),
  ]);

  if (workflowError) {
    console.error("[haccp-reminders] failed to load workflows", workflowError);
    return jsonResponse({ error: workflowError.message }, 500);
  }

  if (subscriptionError) {
    console.error("[haccp-reminders] failed to load subscriptions", subscriptionError);
    return jsonResponse({ error: subscriptionError.message }, 500);
  }

  const pushResult = await sendPushNotifications({
    supabase,
    reminders: dueReminders,
    workflows: (workflows || []) as WorkflowRow[],
    subscriptions: (subscriptions || []) as PushSubscriptionRow[],
  });

  return jsonResponse({
    processed: dueReminders.length,
    pushed: pushResult.sent,
    removedSubscriptions: pushResult.removed,
  });
});
