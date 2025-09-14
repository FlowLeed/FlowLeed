import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationEmailData {
  email: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteToken: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get request data
    const { email, organizationName, inviterName, role, inviteToken }: InvitationEmailData = await req.json()

    // TODO: Implement email sending with a service like Resend
    // For now, we'll just log the invitation details
    console.log('Team invitation email would be sent:', {
      to: email,
      organizationName,
      inviterName,
      role,
      inviteLink: `${Deno.env.get('SITE_URL')}/invite/${inviteToken}`
    })

    // Here you would integrate with an email service like Resend:
    /*
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@yourapp.com',
        to: [email],
        subject: `You're invited to join ${organizationName}`,
        html: `
          <h2>You've been invited to join ${organizationName}</h2>
          <p>${inviterName} has invited you to join their team as a ${role}.</p>
          <p><a href="${Deno.env.get('SITE_URL')}/invite/${inviteToken}">Accept Invitation</a></p>
          <p>This invitation will expire in 7 days.</p>
        `
      })
    })

    if (!emailResponse.ok) {
      throw new Error('Failed to send email')
    }
    */

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation email sent successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})