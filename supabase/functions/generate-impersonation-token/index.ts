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
        _admin_user_id: adminUser.id,
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

    // Fetch target user email
    const { data: targetUserRes, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (getUserError || !targetUserRes?.user?.email) {
      console.error('[generate-impersonation-token] Failed to get target user email:', getUserError);
      throw new Error('Failed to resolve target user email');
    }
    const targetEmail = targetUserRes.user.email as string;

    // Generate a magic link and extract the token from the URL
    const redirectTo = Deno.env.get('SITE_URL') || supabaseUrl;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: { redirectTo },
    });

    if (linkError || !linkData) {
      console.error('[generate-impersonation-token] Failed to generate magiclink:', linkError);
      throw new Error('Failed to generate impersonation verification token');
    }

    // Extract token from the action_link URL
    const actionLink = linkData.properties?.action_link;
    if (!actionLink) {
      throw new Error('No action link generated for impersonation');
    }

    // Parse the URL to extract the token hash
    const url = new URL(actionLink);
    const token = url.searchParams.get('token');
    const tokenHash = url.hash.replace('#', '').split('&').find(p => p.startsWith('access_token='))?.split('=')[1];
    
    const impersonationToken = token || tokenHash;
    if (!impersonationToken) {
      throw new Error('No token found in magic link');
    }

    console.log('[generate-impersonation-token] Magic link token generated successfully');

    return new Response(
      JSON.stringify({
        sessionId,
        email: targetEmail,
        token: impersonationToken,
        tokenType: 'magiclink',
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
