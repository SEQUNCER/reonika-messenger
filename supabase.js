// supabase/functions/send-push-notification/index.js
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import webpush from 'https://esm.sh/web-push@3.6.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { subscription, title, body, data } = await req.json()

    // Установите свои VAPID ключи
    const vapidKeys = {
      publicKey: Deno.env.get('BPne5W8Q840JJ6b9oEGZXc0SSgVd5WfYLUk83yC69ZVnRhJOJ2kEQsT3wjKYKUMqL7Ei9twJNmGetaej5oNUNWw'),
      privateKey: Deno.env.get('iNJhzXElz6_ZiIMgywFzYaTLRHq422DsOenKvdc8RYE')
    }

    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    )

    // Отправляем push-уведомление
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title,
        body,
        icon: '/icon-192x192.png',
        data: data || {},
        vibrate: [200, 100, 200]
      })
    )

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error sending push notification:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})