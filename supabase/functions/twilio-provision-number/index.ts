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

    const { areaCode, friendlyName, isPrimary, organizationId } = await req.json()

    // Check if user is system admin
    const { data: systemRole } = await supabaseClient.rpc('get_user_system_role', {
      _user_id: user.id
    })

    let orgId = organizationId

    if (systemRole === 'super_admin' || systemRole === 'support_admin') {
      // System admins must provide organizationId
      if (!orgId) {
        throw new Error('Organization ID required for system admins')
      }
    } else {
      // Check if user is admin in their organization
      const { data: membership } = await supabaseClient
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .single()

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new Error('Only admins can provision phone numbers')
      }
      orgId = membership.organization_id
    }

    console.log('Searching for available numbers in area code:', areaCode)

    // Search for available numbers
    const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&SmsEnabled=true&VoiceEnabled=true&Limit=1`
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
      }
    })

    const searchData = await searchResponse.json()
    if (!searchData.available_phone_numbers || searchData.available_phone_numbers.length === 0) {
      throw new Error('No available numbers found in this area code')
    }

    const phoneNumber = searchData.available_phone_numbers[0].phone_number

    console.log('Purchasing number:', phoneNumber)

    // Purchase the number
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`
    const purchaseResponse = await fetch(purchaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        PhoneNumber: phoneNumber,
        FriendlyName: friendlyName || phoneNumber,
        SmsUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook-sms`,
        VoiceUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook-voice`,
        StatusCallback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook-status`
      })
    })

    const purchaseData = await purchaseResponse.json()
    if (purchaseResponse.status !== 201) {
      throw new Error(purchaseData.message || 'Failed to purchase number')
    }

    console.log('Number purchased, storing in database')

    // If this is primary, unset other primary numbers
    if (isPrimary) {
      await supabaseClient
        .from('twilio_phone_numbers')
        .update({ is_primary: false })
        .eq('organization_id', orgId)
        .eq('is_primary', true)
    }

    // Store in database
    const { data: dbNumber, error: dbError } = await supabaseClient
      .from('twilio_phone_numbers')
      .insert({
        organization_id: orgId,
        phone_number: purchaseData.phone_number,
        friendly_name: friendlyName || purchaseData.phone_number,
        sid: purchaseData.sid,
        capabilities: {
          voice: purchaseData.capabilities.voice,
          sms: purchaseData.capabilities.sms,
          mms: purchaseData.capabilities.mms
        },
        is_primary: isPrimary || false,
        status: 'active'
      })
      .select()
      .single()

    if (dbError) throw dbError

    console.log('Number provisioned successfully')

    return new Response(
      JSON.stringify({ success: true, data: dbNumber }),
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