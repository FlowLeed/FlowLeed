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

    const { contactId, body, fromNumberId } = await req.json()

    console.log('Sending SMS to contact:', contactId)

    // Get user's organization
    const { data: membership } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) throw new Error('User not in organization')

    // Get contact info
    const { data: contact } = await supabaseClient
      .from('contacts')
      .select('phone, organization_id, is_demo')
      .eq('id', contactId)
      .single()

    if (!contact || !contact.phone) {
      throw new Error('Contact has no phone number')
    }

    // Guardrail: never place real outbound traffic against sample (demo) people.
    if (contact.is_demo) {
      throw new Error('This is sample data — outbound messages and calls are disabled for sample people.')
    }

    // Determine which number to use
    let fromNumber
    if (fromNumberId) {
      const { data: phoneNumber } = await supabaseClient
        .from('twilio_phone_numbers')
        .select('*')
        .eq('id', fromNumberId)
        .eq('organization_id', membership.organization_id)
        .single()
      fromNumber = phoneNumber
    } else {
      // Use user's assigned number or org primary
      const { data: userNumber } = await supabaseClient
        .from('twilio_phone_numbers')
        .select('*')
        .eq('assigned_to_user_id', user.id)
        .eq('organization_id', membership.organization_id)
        .eq('status', 'active')
        .maybeSingle()

      if (userNumber) {
        fromNumber = userNumber
      } else {
        const { data: primaryNumber } = await supabaseClient
          .from('twilio_phone_numbers')
          .select('*')
          .eq('organization_id', membership.organization_id)
          .eq('is_primary', true)
          .eq('status', 'active')
          .single()
        fromNumber = primaryNumber
      }
    }

    if (!fromNumber) {
      throw new Error('No phone number available to send from')
    }

    console.log('Sending SMS via Twilio from:', fromNumber.phone_number)

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: contact.phone,
        From: fromNumber.phone_number,
        Body: body
      })
    })

    const twilioData = await twilioResponse.json()
    if (twilioResponse.status !== 201) {
      throw new Error(twilioData.message || 'Failed to send SMS')
    }

    console.log('SMS sent, storing in database')

    // Store in database
    const { data: message, error: dbError } = await supabaseClient
      .from('sms_messages')
      .insert({
        organization_id: membership.organization_id,
        contact_id: contactId,
        twilio_message_sid: twilioData.sid,
        from_number: fromNumber.phone_number,
        to_number: contact.phone,
        body: body,
        direction: 'outbound',
        status: twilioData.status,
        twilio_phone_number_id: fromNumber.id,
        sent_by_user_id: user.id
      })
      .select()
      .single()

    if (dbError) throw dbError

    console.log('SMS sent successfully')

    return new Response(
      JSON.stringify({ success: true, data: message }),
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