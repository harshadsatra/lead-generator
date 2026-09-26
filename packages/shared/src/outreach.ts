// Assisted WhatsApp: the tool drafts, a human reviews and sends (spec: no automated DMs).
export function whatsappDraft(input: { senderName: string, businessName: string, hook: string | null, service: string | null }) {
  const finding = input.hook ? ` One thing stood out: ${input.hook.charAt(0).toLowerCase()}${input.hook.slice(1)}.` : ''
  const offer = input.service ? ` We help businesses like yours with ${input.service.charAt(0).toLowerCase()}${input.service.slice(1)}.` : ''
  return `Hi, this is ${input.senderName} from Shwez Studio. I came across ${input.businessName} on Google Maps.${finding}${offer} Would a quick 15-minute call this week be useful? Reply STOP and I won't message again.`
}

// wa.me needs the number in international format, digits only.
export function whatsappLink(phoneE164: string, text: string) {
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}
