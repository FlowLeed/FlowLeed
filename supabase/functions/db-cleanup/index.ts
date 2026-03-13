import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: string[] = [];
    let totalDeleted = 0;

    // Step 1: Batch delete from pco_sync_queue (all rows are terminal)
    console.log("Starting pco_sync_queue cleanup...");
    let batchNum = 0;
    while (true) {
      batchNum++;
      const { data, error } = await supabaseAdmin.rpc("exec_sql", {
        sql: `DELETE FROM pco_sync_queue WHERE id IN (SELECT id FROM pco_sync_queue LIMIT 2000) RETURNING id`,
      });

      // Fallback: use direct delete via REST if RPC doesn't exist
      if (error) {
        console.log("RPC not available, using direct delete approach...");
        // Delete via the Supabase client
        const { count, error: delErr } = await supabaseAdmin
          .from("pco_sync_queue")
          .delete()
          .not("id", "is", null)
          .limit(2000);
        
        if (delErr) {
          console.error("Delete error:", delErr);
          // Try smaller batch
          const { error: smallDelErr } = await supabaseAdmin
            .from("pco_sync_queue")
            .delete()
            .not("id", "is", null)
            .limit(500);
          
          if (smallDelErr) {
            results.push(`pco_sync_queue: error - ${smallDelErr.message}`);
            break;
          }
        }

        // Check remaining count
        const { count: remaining } = await supabaseAdmin
          .from("pco_sync_queue")
          .select("id", { count: "exact", head: true });

        if (!remaining || remaining === 0) {
          results.push(`pco_sync_queue: all rows deleted after ${batchNum} batches`);
          break;
        }

        totalDeleted += 2000;
        console.log(`Batch ${batchNum}: ~${totalDeleted} deleted, ${remaining} remaining`);

        if (batchNum > 200) {
          results.push(`pco_sync_queue: stopped after 200 batches, ~${totalDeleted} deleted`);
          break;
        }

        // Small delay to avoid overwhelming the DB
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      const deletedCount = Array.isArray(data) ? data.length : 0;
      if (deletedCount === 0) {
        results.push(`pco_sync_queue: all rows deleted after ${batchNum} batches (~${totalDeleted} total)`);
        break;
      }
      totalDeleted += deletedCount;
      console.log(`Batch ${batchNum}: ${deletedCount} deleted, total: ${totalDeleted}`);

      if (batchNum > 200) {
        results.push(`pco_sync_queue: stopped after 200 batches, ${totalDeleted} deleted`);
        break;
      }

      await new Promise(r => setTimeout(r, 100));
    }

    // Step 2: Purge old cron history
    console.log("Cleaning cron.job_run_details...");
    try {
      // Can't access cron schema via REST, so we'll note it
      results.push("cron.job_run_details: must be cleaned via SQL Editor (not accessible via REST API)");
    } catch (e) {
      results.push(`cron cleanup: ${e.message}`);
    }

    // Step 3: Clean terminal pco_sync_jobs older than 7 days
    console.log("Cleaning pco_sync_jobs...");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: jobsErr, count: jobsDeleted } = await supabaseAdmin
      .from("pco_sync_jobs")
      .delete({ count: "exact" })
      .in("status", ["completed", "cancelled", "failed"])
      .lt("started_at", sevenDaysAgo);

    if (jobsErr) {
      results.push(`pco_sync_jobs: error - ${jobsErr.message}`);
    } else {
      results.push(`pco_sync_jobs: deleted ${jobsDeleted ?? 0} terminal rows older than 7 days`);
    }

    // Check final counts
    const { count: queueRemaining } = await supabaseAdmin
      .from("pco_sync_queue")
      .select("id", { count: "exact", head: true });

    const { count: jobsRemaining } = await supabaseAdmin
      .from("pco_sync_jobs")
      .select("id", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        success: true,
        results,
        remaining: {
          pco_sync_queue: queueRemaining ?? "unknown",
          pco_sync_jobs: jobsRemaining ?? "unknown",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
