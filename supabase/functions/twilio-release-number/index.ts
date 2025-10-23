import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { corsHeaders } from '../_shared/cors.ts'

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!

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
      throw new Error('Only admins can release phone numbers')
    }

    const { phoneNumberId } = await req.json()

    console.log('Releasing phone number:', phoneNumberId)

    // Get phone number details
    const { data: phoneNumber } = await supabaseClient
      .from('twilio_phone_numbers')
      .select('*')
      .eq('id', phoneNumberId)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!phoneNumber) {
      throw new Error('Phone number not found')
    }

    // Release from Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${phoneNumber.sid}.json`
    const twilioResponse = await fetch(twilioUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
      }
    })

    if (twilioResponse.status !== 204) {
      const error = await twilioResponse.json()
      throw new Error(error.message || 'Failed to release number from Twilio')
    }

    console.log('Number released from Twilio, updating database')

    // Update database
    await supabaseClient
      .from('twilio_phone_numbers')
      .update({
        status: 'released',
        released_at: new Date().toISOString()
      })
      .eq('id', phoneNumberId)

    console.log('Number released successfully')

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