
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res, status, data) {
  return res.status(status).json(data);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, {
      error: "Method not allowed"
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return send(res, 503, {
      error: "Sunucu yapılandırması eksik."
    });
  }

  // Kullanıcının oturum anahtarını al.
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return send(res, 401, {
      error: "Giriş yapmanız gerekiyor."
    });
  }

  const accessToken = match[1];

  try {
    // Oturumun geçerli olduğunu Supabase ile doğrula.
    const userResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!userResponse.ok) {
      return send(res, 401, {
        error: "Oturum geçersiz veya süresi dolmuş."
      });
    }

    const user = await userResponse.json();

    if (!user.id) {
      return send(res, 401, {
        error: "Kullanıcı doğrulanamadı."
      });
    }

    const serviceHeaders = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json"
    };

    // Kullanıcının yönetici yetkisini kontrol et.
    const adminResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_users` +
      `?user_id=eq.${encodeURIComponent(user.id)}` +
      `&select=user_id`,
      {
        headers: serviceHeaders
      }
    );

    if (!adminResponse.ok) {
      console.error(
        "Admin authorization check failed:",
        adminResponse.status
      );
      return send(res, 500, {
        error: "Yönetici yetkisi kontrol edilemedi."
      });
    }

    const admins = await adminResponse.json();

    if (!Array.isArray(admins) || admins.length === 0) {
      return send(res, 403, {
        error: "Bu alana erişim yetkiniz yok."
      });
    }

    // Yalnızca doğrulanmış yöneticilere talepleri göster.
    const requestsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/update_requests` +
      `?select=*&order=created_at.desc&limit=100`,
      {
        headers: serviceHeaders
      }
    );

    if (!requestsResponse.ok) {
      console.error(
        "Admin requests fetch failed:",
        requestsResponse.status
      );
      return send(res, 500, {
        error: "Talepler alınamadı."
      });
    }

    const requests = await requestsResponse.json();

    return send(res, 200, {
      success: true,
      requests
    });

  } catch (error) {
    console.error("Admin API error:", error.message);

    return send(res, 500, {
      error: "Sunucu hatası."
    });
  }
}
