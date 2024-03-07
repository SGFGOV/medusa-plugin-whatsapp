import { Response } from "express";
import { WhatsappService } from "../../services/whatsapp";
import {
  WhatsappMediaMessage,
  WhatsappRequest,
  WhatsappLocationMessage,
} from "../../types";

export default async (req: WhatsappRequest, res: Response): Promise<void> => {
  try {
    const service = req.scope.resolve("whatsappService") as WhatsappService;
    const whatsappMessage: WhatsappMediaMessage | WhatsappLocationMessage =
      req.body as WhatsappMediaMessage;

    await service.processReceivedConversationPrehook(
      req.scope,
      whatsappMessage
    );

    res.set("Content-Type", "text/xml");
    res.sendStatus(200);
  } catch (err) {
    res.status(400);
  }
};
