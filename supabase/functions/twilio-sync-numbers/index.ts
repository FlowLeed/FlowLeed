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

    // Create a service role client for bypassing RLS on inserts
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is system admin
    const { data: systemRole } = await supabaseClient.rpc('get_user_system_role', {
      _user_id: user.id
    })

    if (systemRole !== 'super_admin' && systemRole !== 'support_admin') {
      throw new Error('Only system admins can sync Twilio numbers')
    }

    console.log('Fetching all phone numbers from Twilio')

    // Fetch all incoming phone numbers from Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`
    const twilioResponse = await fetch(twilioUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
      }
    })

    if (!twilioResponse.ok) {
      throw new Error('Failed to fetch numbers from Twilio')
    }

    const twilioData = await twilioResponse.json()
    const twilioNumbers = twilioData.incoming_phone_numbers || []

    console.log(`Found ${twilioNumbers.length} numbers in Twilio`)

    // Fetch all existing numbers from our database
    const { data: dbNumbers, error: dbError } = await supabaseClient
      .from('twilio_phone_numbers')
      .select('sid, phone_number')

    if (dbError) throw dbError

    const dbSids = new Set(dbNumbers?.map(n => n.sid) || [])
    const missingNumbers = twilioNumbers.filter((n: any) => !dbSids.has(n.sid))

    console.log(`Found ${missingNumbers.length} numbers missing from database`)

    if (missingNumbers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All Twilio numbers are already synced',
          synced_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For each missing number, we need to determine which organization it belongs to
    // We'll look for organization_id in the friendly name or use a default approach
    const insertPromises = missingNumbers.map(async (twilioNumber: any) => {
      // Try to parse organization_id from friendly_name if it follows a pattern
      // Otherwise, we'll need to manually assign it
      let organizationId = null
      
      // Get the first organization (for now - super admin can reassign later)
      const { data: firstOrg } = await supabaseClient
        .from('organizations')
        .select('id')
        .limit(1)
        .single()

      organizationId = firstOrg?.id

      if (!organizationId) {
        console.log(`Skipping ${twilioNumber.phone_number} - no organization found`)
        return null
      }

      // Insert the number using service role to bypass RLS
      const { data, error } = await supabaseServiceClient
        .from('twilio_phone_numbers')
        .insert({
          organization_id: organizationId,
          phone_number: twilioNumber.phone_number,
          friendly_name: twilioNumber.friendly_name || twilioNumber.phone_number,
          sid: twilioNumber.sid,
          capabilities: {
            voice: twilioNumber.capabilities.voice,
            sms: twilioNumber.capabilities.sms,
            mms: twilioNumber.capabilities.mms
          },
          is_primary: false,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        console.error(`Error inserting ${twilioNumber.phone_number}:`, error)
        return null
      }

      console.log(`Synced ${twilioNumber.phone_number}`)
      return data
    })

    const results = await Promise.all(insertPromises)
    const syncedNumbers = results.filter(r => r !== null)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${syncedNumbers.length} number(s) from Twilio`,
        synced_count: syncedNumbers.length,
        data: syncedNumbers
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as any)?.message || 'Unknown error' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
