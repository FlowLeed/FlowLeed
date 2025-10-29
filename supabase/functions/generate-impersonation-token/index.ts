import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders } from '../_shared/cors.ts';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

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

    // Get JWT secret
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET is not configured');
    }

    // Generate custom JWT token for the target user
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + (4 * 60 * 60); // 4 hours from now
    
    const payload = {
      iss: supabaseUrl + '/auth/v1',
      sub: targetUserId,
      aud: 'authenticated',
      exp: expiresAt,
      iat: now,
      email: '', // We don't include email for security
      phone: '',
      app_metadata: {
        provider: 'impersonation',
        providers: ['impersonation'],
      },
      user_metadata: {},
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: 'impersonation', timestamp: now }],
      session_id: sessionId,
      is_anonymous: false,
    };

    // Create signing key from secret
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the JWT
    const accessToken = await create({ alg: 'HS256', typ: 'JWT' }, payload, key);

    console.log('[generate-impersonation-token] Custom JWT token generated successfully');

    return new Response(
      JSON.stringify({
        sessionId,
        accessToken,
        refreshToken: null, // No refresh token for impersonation
        expiresAt,
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
