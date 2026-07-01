// Send WhatsApp template messages via Kapso (a proxy over Meta's official WhatsApp
// Business Cloud API — no account-ban risk). Business-initiated notifications must use a
// pre-approved template; positional params fill {{1}}, {{2}}, … in order.
//
// Env: KAPSO_API_KEY, KAPSO_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME,
//      WHATSAPP_TEMPLATE_LANG (default "en_US" — must match the approved template's language).
//
// Provider is isolated here so swapping BSPs later is a one-file change.

const KAPSO_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";

/** Digits only — WhatsApp identifies recipients by full international number without "+",
 *  spaces, or a national leading 0 (our stored numbers are already in this form). */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/** Send one approved-template message. Best-effort: returns { ok }, never throws into the
 *  caller. No-ops (with a warning) when Kapso env is unset, so dev without creds is fine. */
export async function sendWhatsApp(
  phone: string,
  params: string[],
): Promise<{ ok: boolean }> {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG ?? "en_US";
  if (!apiKey || !phoneNumberId || !template) {
    console.warn("[whatsapp] Kapso not configured (KAPSO_API_KEY/PHONE_NUMBER_ID/TEMPLATE) — skipping");
    return { ok: false };
  }

  const to = normalizePhone(phone);
  if (!to) return { ok: false };

  try {
    const res = await fetch(`${KAPSO_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: lang },
          components: [
            { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
          ],
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[whatsapp] send failed ${res.status}: ${detail.slice(0, 300)}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[whatsapp] send error:", err);
    return { ok: false };
  }
}
