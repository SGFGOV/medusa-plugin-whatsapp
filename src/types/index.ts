import { Request } from "express";

export interface WhatsappRequest extends Request {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: Record<string, any>;
}

export interface WhatsappMessage {
  sender: "BOT" | "USER";
  message: WhatsappMediaMessage | string;
}

export interface WhatsappSession {
  user: string;
  bot: string;
  messages: WhatsappMessage[];
}

export interface WhatsappBasicMessage {
  SmsMessageSid: string;
  NumMedia: string;
  ProfileName: string;
  SmsSid: string;
  WaId: string;
  SmsStatus: string;
  Body: string;
  To: string;
  NumSegments: string;
  ReferralNumMedia: string;
  MessageSid: string;
  AccountSid: string;
  From: string;
  ApiVersion: string;
}

export interface WhatsappMediaMessage extends WhatsappBasicMessage {
  MediaContentType0: string;
  MediaUrl0: string;
}

export interface WhatsappLocationMessage extends WhatsappBasicMessage {
  Longitude: string;
  Latitude: string;
}
