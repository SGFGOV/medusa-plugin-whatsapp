import { Router } from "express";
import * as bodyParser from "body-parser";
import cors from "cors";
import { getConfigFile } from "medusa-core-utils";

import middlewares from "../middleware";
import { WhatsappInterfaceOptions } from "../../services/whatsapp-interface";
import { ConfigModule } from "@medusajs/medusa/dist/types/global";
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
  whatsAppMessageRouter.post(whatsappPath, (req, res, next) => {
    console.log("received whatsapp message");
    next();
  });
  whatsAppMessageRouter.post(whatsappPath, bodyParser.text());
  whatsAppMessageRouter.post(whatsappPath, bodyParser.urlencoded());
  whatsAppMessageRouter.post(whatsappPath, bodyParser.json());
  whatsAppMessageRouter.post(whatsappPath, bodyParser.raw());
  whatsAppMessageRouter.post(
    whatsappPath,
    middlewares.verifyTwilioHeader(options)
  );
  // route.post(whatsappPath, bodyParser.json());

  whatsAppMessageRouter.post(whatsappPath, whatsappReceiveHandler);
  return whatsAppMessageRouter;
};
