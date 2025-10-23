import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: membership } = await supabaseClient
      .from('organization_members')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Only admins can assign phone numbers')
    }

    const { phoneNumberId, userId } = await req.json()

    console.log('Assigning phone number:', phoneNumberId, 'to user:', userId)

    // Verify phone number belongs to organization
    const { data: phoneNumber } = await supabaseClient
      .from('twilio_phone_numbers')
      .select('*')
      .eq('id', phoneNumberId)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!phoneNumber) {
      throw new Error('Phone number not found')
    }

    // Verify user belongs to organization
    if (userId) {
      const { data: targetMember } = await supabaseClient
        .from('organization_members')
        .select('user_id')
        .eq('user_id', userId)
        .eq('organization_id', membership.organization_id)
        .single()

      if (!targetMember) {
        throw new Error('User not found in organization')
      }
    }

    // Update assignment
    await supabaseClient
      .from('twilio_phone_numbers')
      .update({
        assigned_to_user_id: userId || null
      })
      .eq('id', phoneNumberId)

    console.log('Number assigned successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})