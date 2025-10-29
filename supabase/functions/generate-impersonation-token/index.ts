import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !adminUser) {
      console.error('[generate-impersonation-token] Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('[generate-impersonation-token] Admin user:', adminUser.id);

    // Verify caller is system admin
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin
      .rpc('is_system_admin', { _user_id: adminUser.id });
    
    if (adminCheckError || !isAdmin) {
      console.error('[generate-impersonation-token] Not a system admin:', adminUser.id);
      throw new Error('Only system administrators can generate impersonation tokens');
    }

    // Get request body
    const { targetUserId, targetOrgId, reason } = await req.json();
    
    if (!targetUserId || !targetOrgId || !reason) {
      throw new Error('Missing required parameters: targetUserId, targetOrgId, reason');
    }

    console.log('[generate-impersonation-token] Generating token for user:', targetUserId);

    // Verify target user exists and belongs to target org
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('user_id', targetUserId)
      .eq('organization_id', targetOrgId)
      .single();
    
    if (membershipError || !membership) {
      console.error('[generate-impersonation-token] Target user not in org:', membershipError);
      throw new Error('Target user not found in organization');
    }

    // Create impersonation session in DB
    const { data: sessionId, error: sessionError } = await supabaseAdmin
      .rpc('start_impersonation_session', {
        _target_org_id: targetOrgId,
        _reason: reason,
        _ip_address: req.headers.get('x-forwarded-for') || null,
        _user_agent: req.headers.get('user-agent') || null,
      });

    if (sessionError) {
      console.error('[generate-impersonation-token] Failed to create session:', sessionError);
      throw sessionError;
    }

    console.log('[generate-impersonation-token] Created session:', sessionId);

    // Generate a short-lived access token for the target user (4 hours)
    const { data: sessionData, error: tokenError } = await supabaseAdmin.auth.admin.createSession({
      user_id: targetUserId,
      // Token expires in 4 hours
    });

    if (tokenError || !sessionData) {
      console.error('[generate-impersonation-token] Failed to create session:', tokenError);
      throw new Error('Failed to generate impersonation token');
    }

    console.log('[generate-impersonation-token] Token generated successfully');

    return new Response(
      JSON.stringify({
        sessionId,
        accessToken: sessionData.access_token,
        refreshToken: sessionData.refresh_token,
        expiresAt: sessionData.expires_at,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[generate-impersonation-token] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
