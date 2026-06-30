export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Flex <onboarding@resend.dev>";

  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Код подтверждения Flex",
        text: `Ваш код: ${code}. Действует 10 минут.`,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Email не отправлен: ${text.slice(0, 120)}`);
    }
    return;
  }

  console.log(`[Flex OTP email → ${email}] код: ${code}`);
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (sid && token && from) {
    const body = new URLSearchParams({
      To: phone,
      From: from,
      Body: `Flex код: ${code}`,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SMS не отправлено: ${text.slice(0, 120)}`);
    }
    return;
  }

  console.log(`[Flex OTP SMS → ${phone}] код: ${code}`);
}

export async function dispatchOtp(
  channel: "email" | "sms",
  target: string,
  code: string
): Promise<void> {
  if (channel === "sms") {
    await sendOtpSms(target, code);
  } else {
    await sendOtpEmail(target, code);
  }
}
