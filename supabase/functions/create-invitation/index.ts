import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PipelineAssignment {
  pipeline_id: string;
  role: string;
}

interface CreateInvitationRequest {
  email: string;
  role: string;
  organizationId: string;
  pipelineAssignments?: PipelineAssignment[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    console.log('Authenticated user:', user.id)

    const { email, role, organizationId, pipelineAssignments = [] }: CreateInvitationRequest = await req.json()

    // Validate pipeline assignments shape (role must be 'lead' or 'member')
    const cleanAssignments = Array.isArray(pipelineAssignments)
      ? pipelineAssignments
          .filter((a) => a && typeof a.pipeline_id === 'string' && typeof a.role === 'string')
          .map((a) => ({
            pipeline_id: a.pipeline_id,
            role: a.role === 'lead' ? 'lead' : 'member',
          }))
      : []

    // Validate input
    if (!email || !role || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, role, organizationId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const emailLower = email.toLowerCase()

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailLower)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Creating invitation for:', { email: emailLower, role, organizationId })

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is admin/owner of the organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error checking membership:', membershipError)
      throw membershipError
    }

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      console.error('User not authorized:', { userId: user.id, membership })
      return new Response(
        JSON.stringify({ error: 'You must be an owner or admin to invite team members' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .single()

    if (orgError || !organization) {
      console.error('Organization not found:', orgError)
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Get inviter profile
    const { data: inviterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching inviter profile:', profileError)
      throw profileError
    }

    // Check if email already has a profile
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', emailLower)
      .maybeSingle()

    if (profileCheckError) throw profileCheckError

    if (existingProfile) {
      // Check if already a member
      const { data: existingMember, error: memberCheckError } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingProfile.user_id)
        .maybeSingle()

      if (memberCheckError) throw memberCheckError

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'This user is already a member of your organization' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation, error: inviteCheckError } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', emailLower)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (inviteCheckError) throw inviteCheckError

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: "There's already a pending invitation for this email" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Generate secure token
    const token = crypto.randomUUID()
    console.log('Generated invitation token:', token)

    // Create invitation in database
    const { data: invitation, error: insertError } = await supabaseAdmin
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email: emailLower,
        role: role,
        invited_by_user_id: user.id,
        token: token,
        pipeline_assignments: cleanAssignments,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create invitation:', insertError)
      throw insertError
    }

    console.log('Invitation created in database:', invitation.id)

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      // Delete the invitation we just created
      await supabaseAdmin
        .from('invitations')
        .delete()
        .eq('id', invitation.id)
      
      throw new Error('Email service not configured')
    }

    const resend = new Resend(resendApiKey)
    
    // Send invitation email
    console.log('Sending invitation email to:', emailLower)
    const emailResponse = await resend.emails.send({
      from: 'Team Invitations <noreply@flowleed.com>',
      to: [emailLower],
      subject: `You're invited to join ${organization.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Team Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #495057; margin-top: 0;">Join ${organization.name}</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${inviterProfile.full_name || inviterProfile.email}</strong> has invited you to join their team as a <strong>${role}</strong>.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/invite/${token}" 
                 style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin-top: 20px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                ⏰ This invitation will expire in 7 days.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            
            <p style="font-size: 14px; color: #6c757d; margin-bottom: 5px;">
              If you can't click the button above, copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; word-break: break-all; color: #6c757d; background: #f8f9fa; padding: 10px; border-radius: 3px;">
              ${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/invite/${token}
            </p>
            
            <p style="font-size: 12px; color: #6c757d; margin-top: 20px;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `
    })

    if (emailResponse.error) {
      console.error('Failed to send email via Resend:', emailResponse.error)
      
      // Delete the invitation since email failed
      await supabaseAdmin
        .from('invitations')
        .delete()
        .eq('id', invitation.id)
      
      throw new Error(`Failed to send email: ${emailResponse.error.message}`)
    }

    console.log('Email sent successfully:', emailResponse.data?.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation created and email sent successfully',
        invitationId: invitation.id,
        emailId: emailResponse.data?.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error creating invitation:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
