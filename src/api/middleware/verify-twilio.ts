import { NextFunction, Request, Response } from "express";
import { WhatsappInterfaceOptions } from "services/whatsapp";
import twilio from "twilio";

export default (options: WhatsappInterfaceOptions, path: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const twilioSignature = req.headers["x-twilio-signature"];
    const params = req.body;
    let requestIsValid = false;
    if (!params || params?.length == 0) {
      requestIsValid = false;
    } else {
      let url;
      if (options.medusaServerProtocol.toLowerCase() == "https") {
        url = `${options.medusaServerProtocol}://${options.medusaServerHost}${path}`;
      } else if (options.medusaServerPort && options.medusaServerPort != "") {
        url = `${options.medusaServerProtocol}://${options.medusaServerHost}:${options.medusaServerPort}${path}`;
      } else if (!options.medusaServerPort || options.medusaServerPort == "") {
        url = `${options.medusaServerProtocol}://${options.medusaServerHost}${path}`;
      }

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
