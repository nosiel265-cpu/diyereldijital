
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const allowedTypes = ["google", "instagram", "iban"];

function send(res, status, data) {
  return res.status(status).json(data);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return send(res, 503, {
      error: "Talep sistemi henüz yapılandırılmadı."
    });
  }

  const origin = req.headers.origin;

  if (origin) {
    try {
      const allowedOrigin =
        new URL("https://diyereldijital.online").origin;

      if (new URL(origin).origin !== allowedOrigin) {
        return send(res, 403, { error: "Forbidden" });
      }
    } catch {
      return send(res, 403, { error: "Forbidden" });
    }
  }

  const body = req.body;

  if (!body || typeof body !== "object" ||
      Array.isArray(body)) {
    return send(res, 400, { error: "Geçersiz talep." });
  }

  const fields = [
    "business_name",
    "whatsapp_number",
    "card_type",
    "new_information",
    "description"
  ];

  for (const field of fields) {
    if (body[field] !== undefined &&
        typeof body[field] !== "string") {
      return send(res, 400, {
        error: "Geçersiz alan: " + field
      });
    }
  }

  const business_name = (body.business_name || "").trim();
  const whatsapp_number =
    (body.whatsapp_number || "").trim();
  const card_type = (body.card_type || "").trim();
  const new_information =
    (body.new_information || "").trim();
  const description = (body.description || "").trim();

  if (
    business_name.length < 2 ||
    business_name.length > 150 ||
    !/^\+?[0-9 ()-]{7,25}$/.test(whatsapp_number) ||
    !allowedTypes.includes(card_type) ||
    new_information.length < 1 ||
    new_information.length > 2000 ||
    description.length > 2000
  ) {
    return send(res, 400, {
      error: "Lütfen form bilgilerini kontrol edin."
    });
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/update_requests`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization:
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          business_name,
          whatsapp_number,
          card_type,
          new_information,
          description
        })
      }
    );

    if (!response.ok) {
     const errorText = await response.text();

console.error(
  "Supabase insert failed:",
  response.status,
  errorText
);

      return send(res, 500, {
        error: "Talep kaydedilemedi."
      });
    }

    return send(res, 201, {
      success: true,
      message: "Talebiniz başarıyla alınmıştır."
    });
  } catch (error) {
    console.error("Request API error:", error.message);

    return send(res, 500, {
      error: "Sunucu hatası."
    });
  }
}
