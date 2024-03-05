import { Router } from "express";
import * as bodyParser from "body-parser";
import cors from "cors";
import { getConfigFile } from "medusa-core-utils";

import middlewares from "../middleware";
import { WhatsappInterfaceOptions } from "../../services/whatsapp";
import { ConfigModule, Logger } from "@medusajs/medusa/dist/types/global";
import whatsappReceiveHandler from "./whastapp-route-handler";
import { BodyParser } from "body-parser";
const whatsAppMessageRouter = Router();

export default (
  app: Router,
  options: WhatsappInterfaceOptions,
  config: ConfigModule
): Router => {
  const whatsappPath = "/received";
  app.use("/whatsapp", whatsAppMessageRouter);

  const corsOptions = {
    origin: "https://api.twilio.com",
    credentials: true,
  };
  if (process.env.NODE_ENV != "test") {
    whatsAppMessageRouter.options(whatsappPath, cors(corsOptions));
    whatsAppMessageRouter.post(whatsappPath, cors(corsOptions));
  }
  whatsAppMessageRouter.post(
    whatsappPath,
    (req, res, next) => {
      const logger = req.scope.resolve("logger") as Logger;
      logger.debug("received whatsapp message");
      next();
    },
    bodyParser.text(),
    bodyParser.urlencoded(),
    bodyParser.json(),
    bodyParser.json(),
    middlewares.verifyTwilioHeader(options),
    whatsappReceiveHandler
  );
  // whatsAppMessageRouter.post(whatsappPath);
  // whatsAppMessageRouter.post(whatsappPath);
  // whatsAppMessageRouter.post(whatsappPath);
  // whatsAppMessageRouter.post(whatsappPath, bodyParser.json());
  // whatsAppMessageRouter.post(
  //   whatsappPath,
   
  // );
  // // route.post(whatsappPath, bodyParser.json());

  whatsAppMessageRouter.post(whatsappPath, whatsappReceiveHandler);
  return whatsAppMessageRouter;
};
