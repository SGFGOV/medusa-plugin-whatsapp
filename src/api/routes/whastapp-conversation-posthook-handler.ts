import { Response } from "express";
import { WhatsappService } from "../../services/whatsapp";
import {
  WhatsappMediaMessage,
  WhatsappRequest,
  WhatsappLocationMessage,
} from "types";

export default async (
  req: WhatsappRequest,
  res: Response
): Promise<Response<void | Response<{ message: string }>>> => {
  try {
    const service = req.scope.resolve("whatsappService") as WhatsappService;
    const whatsappMessage: WhatsappMediaMessage | WhatsappLocationMessage =
      req.body as WhatsappMediaMessage;

    await service.processReceivedConversationPosthook(
      req.scope,
      whatsappMessage
    );
    res.set("Content-Type", "text/xml");
    res.sendStatus(200);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};
