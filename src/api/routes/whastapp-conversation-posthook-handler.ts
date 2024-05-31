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
        res.status(200).set("Content-Type", "text/xml");
      }
      res.sendStatus(200);
    }, 4500);

    if (service.processReceivedConversationPosthook) {
      await service.processReceivedConversationPosthook(
        req.scope,
        whatsappMessage
      );
    }
    clearTimeout(timeOut);

    if (!responseSent) {
      responseSent = true;
      res.set("Content-Type", "text/xml");
      res.status(200).send("ok");
    }
  } catch (err) {
    return res.status(400);
  }
};
