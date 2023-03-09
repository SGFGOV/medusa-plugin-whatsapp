import { NextFunction, Request, Response } from "express";
import { WhatsappInterfaceOptions } from "services/whatsapp-interface";
import twilio from "twilio";

export default (options: WhatsappInterfaceOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const twilioSignature = req.headers["x-twilio-signature"];
    const params = req.body;
    let requestIsValid = false;
    if (!params || params?.length == 0) {
      requestIsValid = false;
    } else {
      const url = `${options.medusaServerProtocol}://${options.medusaServerHost}:${options.medusaServerPort}/whatsapp/received`;

      requestIsValid = twilio.validateRequest(
        options.auth_token,
        twilioSignature as string,
        url,
        params
      );
    }
    if (!requestIsValid) {
      return res.status(401).send("Unauthorized");
    } else {
      next();
    }
    // write to a database, call other services, ...
    // then respond to the message!
  };
};
