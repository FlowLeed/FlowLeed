import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const formData = await req.formData()
    const messageSid = formData.get('MessageSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const body = formData.get('Body') as string
    const status = formData.get('SmsStatus') as string
    const numMedia = parseInt(formData.get('NumMedia') as string || '0')

    console.log('Received SMS webhook:', { messageSid, from, to, body, status })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the phone number record
    const { data: phoneNumber } = await supabase
      .from('twilio_phone_numbers')
      .select('*')
      .eq('phone_number', to)
      .eq('status', 'active')
      .single()

    if (!phoneNumber) {
      console.error('Phone number not found:', to)
      return new Response('OK', { status: 200 })
    }

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
          source_type: 'sms'
        })
        .select('id')
        .single()
      
      contactId = newContact?.id
    }

    if (!contactId) {
      console.error('Could not create or find contact')
      return new Response('OK', { status: 200 })
    }

    // Handle media URLs
    const mediaUrls = []
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`)
      if (mediaUrl) {
        mediaUrls.push(mediaUrl)
      }
    }

    // Store message
    await supabase
      .from('sms_messages')
      .insert({
        organization_id: phoneNumber.organization_id,
        contact_id: contactId,
        twilio_message_sid: messageSid,
        from_number: from,
        to_number: to,
        body: body,
        direction: 'inbound',
        status: status,
        twilio_phone_number_id: phoneNumber.id,
        media_urls: mediaUrls
      })

    console.log('SMS stored successfully')

    // Send TwiML response
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Error processing SMS webhook:', error)
    return new Response('OK', { status: 200 })
  }
})