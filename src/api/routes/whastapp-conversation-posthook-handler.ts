import { Response } from "express";
import { WhatsappService } from "../../services/whatsapp";
import {
  WhatsappMediaMessage,
  WhatsappRequest,
  WhatsappLocationMessage,
} from "types";
import { Logger } from "@medusajs/medusa";

export default async (
  req: WhatsappRequest,
  res: Response
): Promise<Response<void | Response<{ message: string }>>> => {
  try {
    const service = req.scope.resolve("whatsappService") as WhatsappService;

    const whatsappMessage: WhatsappMediaMessage | WhatsappLocationMessage =
      req.body as WhatsappMediaMessage;
    let responseSent = false;

    const timeOut = setTimeout(() => {
      if (!responseSent) {
        responseSent = true;
        res.set("Content-Type", "text/xml");
      }
      res.sendStatus(200);
    }, 4500);

    await service.processReceivedConversationPosthook(
      req.scope,
      whatsappMessage
    );
    clearTimeout(timeOut);

    if (!responseSent) {
      responseSent = true;
      res.set("Content-Type", "text/xml");
      res.sendStatus(200);
    }
  } catch (err) {
    return res.status(400);
  }
};
