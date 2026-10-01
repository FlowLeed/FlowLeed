import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const formData = await req.formData()
    
    // Check if this is a call status update or message status update
    const callSid = formData.get('CallSid') as string
    const messageSid = formData.get('MessageSid') as string
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (callSid) {
      // Update call record
      const callStatus = formData.get('CallStatus') as string
      const duration = formData.get('CallDuration') as string
      const recordingUrl = formData.get('RecordingUrl') as string
      const recordingSid = formData.get('RecordingSid') as string
      const transcriptionText = formData.get('TranscriptionText') as string

      console.log('Updating call status:', { callSid, callStatus, duration })

      const updateData: any = { status: callStatus }
      
      if (duration) {
        updateData.duration = parseInt(duration)
      }
      
      if (callStatus === 'in-progress' && !duration) {
        updateData.answered_at = new Date().toISOString()
      }
      
      if (callStatus === 'completed') {
        updateData.ended_at = new Date().toISOString()
      }
      
      if (recordingUrl) {
        updateData.recording_url = recordingUrl
      }
      
      if (recordingSid) {
        updateData.recording_sid = recordingSid
      }
      
      if (transcriptionText) {
        updateData.transcription = transcriptionText
      }

      await supabase
        .from('call_records')
        .update(updateData)
        .eq('twilio_call_sid', callSid)

      console.log('Call status updated successfully')
    }

    if (messageSid) {
      // Update message status
      const messageStatus = formData.get('MessageStatus') as string || formData.get('SmsStatus') as string
      const errorCode = formData.get('ErrorCode') as string
      const errorMessage = formData.get('ErrorMessage') as string

      console.log('Updating message status:', { messageSid, messageStatus })

      const updateData: any = { status: messageStatus }
      
      if (errorCode) {
        updateData.error_code = errorCode
      }
      
      if (errorMessage) {
        updateData.error_message = errorMessage
      }

      await supabase
        .from('sms_messages')
        .update(updateData)
        .eq('twilio_message_sid', messageSid)

      console.log('Message status updated successfully')
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Error processing status webhook:', error)
    return new Response('OK', { status: 200 })
  }
})