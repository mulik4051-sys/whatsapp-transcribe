// WhatsApp voice-message transcription bot
//
// Flow:
//   1. Meta calls GET /webhook once, to verify the endpoint (handshake).
//   2. Meta calls POST /webhook every time a message arrives.
//   3. If the message is a voice note, we download the audio from WhatsApp,
//      send it to OpenAI Whisper for transcription, and reply with the text.
//
// Required environment variables (set these in your hosting provider's
// dashboard - never commit them to a file or paste them in chat):
//   VERIFY_TOKEN        - any string you invent yourself; used only to prove
//                          to Meta that this server is yours during setup.
//   WHATSAPP_TOKEN       - the WhatsApp "Access token" from Meta for Developers
//                          (Step 1/2 of the WhatsApp use case setup).
//   WHATSAPP_PHONE_ID    - the "Phone Number ID" shown next to your test /
//                          business number.
//   OPENAI_API_KEY       - an API key from platform.openai.com, used only to
//                          call the Whisper transcription endpoint.
//
// Nothing here ever logs or stores the values of these variables.

const express = require('express');
const app = express();
app.use(express.json());

const {
    VERIFY_TOKEN,
    WHATSAPP_TOKEN,
    WHATSAPP_PHONE_ID,
    OPENAI_API_KEY,
    GRAPH_API_VERSION = 'v21.0',
    PORT = 3000,
} = process.env;

function assertConfigured(res) {
    const missing = ['VERIFY_TOKEN', 'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'OPENAI_API_KEY']
      .filter((name) => !process.env[name]);
    if (missing.length) {
          console.error('Missing required environment variables:', missing.join(', '));
          if (res) res.status(500).send('Server misconfigured: missing ' + missing.join(', '));
          return false;
    }
    return true;
}

// ---- 1. Webhook verification (Meta calls this once when you save the URL) ----
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

          if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('Webhook verified successfully.');
                return res.status(200).send(challenge);
          }
    console.warn('Webhook verification failed (bad mode/token).');
    return res.sendStatus(403);
});

// ---- 2. Incoming messages ----
app.post('/webhook', async (req, res) => {
    // Always ack fast so Meta doesn't retry the same event.
           res.sendStatus(200);

           if (!assertConfigured(null)) return;

           try {
                 const entry = req.body?.entry?.[0];
                 const change = entry?.changes?.[0];
                 const value = change?.value;
                 const messages = value?.messages;
                 if (!messages || !messages.length) return; // e.g. a status update, not a message

      for (const message of messages) {
              const from = message.from; // sender's phone number
                   if (message.type === 'audio') {
                             console.log(`Voice message received from ${from}, mediaId=${message.audio.id}`);
                             await handleVoiceMessage(from, message.audio.id);
                   } else {
                             console.log(`Ignoring non-audio message of type "${message.type}" from ${from}`);
                   }
      }
           } catch (err) {
                 console.error('Error handling webhook payload:', err);
           }
});

async function handleVoiceMessage(from, mediaId) {
    try {
          const audioBuffer = await downloadWhatsAppMedia(mediaId);
          const transcript = await transcribeAudio(audioBuffer);
          const replyText = transcript?.trim()
            ? `תמלול ההודעה הקולית:\n\n${transcript.trim()}`
                  : 'לא הצלחתי לזהות טקסט בהודעה הקולית.';
          await sendWhatsAppText(from, replyText);
    } catch (err) {
          console.error('Failed to transcribe/reply:', err);
          await sendWhatsAppText(from, 'קרתה שגיאה בתמלול ההודעה הקולית, נסה שוב מאוחר יותר.').catch(() => {});
    }
}

// Fetch the media's temporary URL, then download the actual bytes.
async function downloadWhatsAppMedia(mediaId) {
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, {
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    if (!metaRes.ok) throw new Error(`Failed to look up media: ${metaRes.status} ${await metaRes.text()}`);
    const { url, mime_type: mimeType } = await metaRes.json();

  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
    if (!fileRes.ok) throw new Error(`Failed to download media: ${fileRes.status}`);
    const arrayBuffer = await fileRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType: mimeType || 'audio/ogg' };
}

// Send the audio to OpenAI's Whisper transcription endpoint.
async function transcribeAudio({ buffer, mimeType }) {
    const ext = mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : 'ogg';
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), `voice.${ext}`);
    form.append('model', 'whisper-1');
    // Hint the language when known; Whisper still auto-detects otherwise.
  form.append('language', 'he');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: form,
  });
    if (!res.ok) throw new Error(`Whisper API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.text;
}

// Send a plain text WhatsApp message back to the user.
async function sendWhatsAppText(to, body) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_ID}/messages`, {
          method: 'POST',
          headers: {
                  Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                  'Content-Type': 'application/json',
          },
          body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to,
                  type: 'text',
                  text: { body },
          }),
    });
    if (!res.ok) throw new Error(`Failed to send WhatsApp reply: ${res.status} ${await res.text()}`);
}

app.get('/', (req, res) => res.send('WhatsApp transcription bot is running.'));

app.listen(PORT, () => {
    assertConfigured(null);
    console.log(`Server listening on port ${PORT}`);
});
