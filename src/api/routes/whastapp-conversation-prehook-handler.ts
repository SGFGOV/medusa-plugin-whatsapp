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
    let responseSent = false;
    const timeOut = setTimeout(() => {
      if (!responseSent) {
        responseSent = true;
        res.set("Content-Type", "text/xml");
        res.status(200).send({
          body: "Hi, I need more time, will that be ok ? Please tell me yes or no",
        });
      }
    }, 4900);

    const response = await service.processReceivedConversationPrehook(
      req.scope,
      whatsappMessage
    );
    clearTimeout(timeOut);

    if (!responseSent) {
      responseSent = true;
      res.set("Content-Type", "text/xml");
      res.status(200).send(response);
    }
  } catch (err) {
    res.status(400);
  }
};
