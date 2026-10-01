import { createClient } from '@supabase/supabase-js'
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

    const { phoneNumberId, userId } = await req.json()

    // Check if user is system admin
    const { data: systemRole } = await supabaseClient.rpc('get_user_system_role', {
      _user_id: user.id
    })

    let orgId = null

    if (systemRole !== 'super_admin' && systemRole !== 'support_admin') {
      // Check if user is admin in their organization
      const { data: membership } = await supabaseClient
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .single()

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new Error('Only admins can assign phone numbers')
      }
      orgId = membership.organization_id
    }

    console.log('Assigning phone number:', phoneNumberId, 'to user:', userId)

    // Verify phone number belongs to organization
    const query = supabaseClient
      .from('twilio_phone_numbers')
      .select('*')
      .eq('id', phoneNumberId)
    
    if (orgId) {
      query.eq('organization_id', orgId)
    }
    
    const { data: phoneNumber } = await query.single()

    if (!phoneNumber) {
      throw new Error('Phone number not found')
    }

    // Verify user belongs to organization (if userId provided and orgId exists)
    if (userId && orgId) {
      const { data: targetMember } = await supabaseClient
        .from('organization_members')
        .select('user_id')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
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