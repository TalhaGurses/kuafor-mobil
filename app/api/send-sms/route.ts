import { NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: Request) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Telefon ve mesaj zorunludur" },
        { status: 400 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      // Demo modu - Twilio yoksa SMS atlanmış sayılır
      console.log("SMS gönderildi (demo):", { phone, message });
      return NextResponse.json({ 
        success: true, 
        message: "SMS gönderildi (demo modu - Twilio yapılandırılmamış)" 
      });
    }

    const client = twilio(accountSid, authToken);

    await client.messages.create({
      body: message,
      from: twilioPhone,
      to: phone.startsWith("0") ? `+90${phone.slice(1)}` : phone,
    });

    return NextResponse.json({ success: true, message: "SMS gönderildi" });
  } catch (error: any) {
    console.error("SMS hatası:", error);
    return NextResponse.json(
      { error: error.message || "SMS gönderilemedi" },
      { status: 500 }
    );
  }
}

