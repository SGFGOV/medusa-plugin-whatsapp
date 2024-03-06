import { Request, Response } from "express";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import { WhatsappService } from "../../services/whatsapp";
import { MessagePage } from "twilio/lib/rest/api/v2010/account/message";
import {
  WhatsappMediaMessage,
  WhatsappSession,
  WhatsappMessage,
  WhatsappRequest,
} from "types";

function createWhatsappSession(message: WhatsappMediaMessage): WhatsappSession {
  const firstIncomeMessage: WhatsappMessage = {
    sender: "USER",
    message,
  };
  const whatsappSession: WhatsappSession = {
    user: message.From,
    bot: message.To,
    messages: [firstIncomeMessage],
  };
  return whatsappSession;
}

export default async (
  req: WhatsappRequest,
  res: Response
): Promise<Response<void | Response<{ message: string }>>> => {
  try {
    const service = req.scope.resolve("whatsappService") as WhatsappService;
    let activeSession: WhatsappSession;
    const whatsappMessage: WhatsappMediaMessage =
      req.body as WhatsappMediaMessage;
    if (!req.session.whatsappSessions?.length) {
      activeSession = createWhatsappSession(whatsappMessage);
      req.session.whatsappSessions = [activeSession] as WhatsappSession[];
    } else {
      activeSession = (req.session.whatsappSessions as WhatsappSession[]).find(
        (session) => session.user == whatsappMessage.From
      );
      if (!activeSession) {
        activeSession = createWhatsappSession(whatsappMessage);
        req.session.whatsappSessions.push(activeSession);
      } else {
        activeSession.messages.push({
          sender: "USER",
          message: "whatsappMessage",
        });
      }
    }

    const responeMessage: MessagingResponse =
      await service.processReceivedMessage(
        req.scope,
        whatsappMessage,
        activeSession
      );
    const reponse = responeMessage.toString();
    activeSession.messages.push({
      sender: "BOT",
      message: reponse,
    });
    res.send();
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};
