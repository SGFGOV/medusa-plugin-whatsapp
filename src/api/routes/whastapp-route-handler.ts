import { Request, Response } from "express";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import { WhatsappInterfaceService } from "../../services/whatsapp-interface";

export default async (
  req: Request,
  res: Response
): Promise<Response<void | Response<{ message: string }>>> => {
  try {
    const service = req.scope.resolve(
      "whatsappInterfaceService"
    ) as WhatsappInterfaceService;
    const responeMessage: MessagingResponse =
      await service.processReceivedMessage(req.scope, req.body);
    res.send(responeMessage.toString());
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};
