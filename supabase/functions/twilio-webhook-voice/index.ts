import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callStatus = formData.get('CallStatus') as string
    const direction = formData.get('Direction') as string

    console.log('Received voice webhook:', { callSid, from, to, callStatus, direction })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the phone number record
    const toNumber = direction === 'inbound' ? to : from
    const { data: phoneNumber } = await supabase
      .from('twilio_phone_numbers')
      .select('*')
      .eq('phone_number', toNumber)
      .eq('status', 'active')
      .single()

    if (!phoneNumber) {
      console.error('Phone number not found:', toNumber)
      const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not configured. Please contact support.</Say></Response>'
      return new Response(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // For inbound calls
    if (direction === 'inbound') {
      // Try to find or create contact
      let contactId = null
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', phoneNumber.organization_id)
        .eq('phone', from)
        .maybeSingle()

      if (existingContact) {
        contactId = existingContact.id
      } else {
        // Create new contact
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            organization_id: phoneNumber.organization_id,
            name: from,
            phone: from,
            source_type: 'call'
          })
          .select('id')
          .single()
        
        contactId = newContact?.id
      }

      if (contactId) {
        // Store call record
        await supabase
          .from('call_records')
          .insert({
            organization_id: phoneNumber.organization_id,
            contact_id: contactId,
            twilio_call_sid: callSid,
            from_number: from,
            to_number: to,
            direction: 'inbound',
            status: callStatus,
            call_type: 'inbound',
            twilio_phone_number_id: phoneNumber.id
          })

        console.log('Inbound call stored successfully')
      }
    }

    // Send TwiML response for inbound calls
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please leave a message after the tone.</Say><Record maxLength="120" transcribe="true" transcribeCallback="' + supabaseUrl + '/functions/v1/twilio-webhook-status"/></Response>'
    
    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Error processing voice webhook:', error)
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say></Response>'
    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
})