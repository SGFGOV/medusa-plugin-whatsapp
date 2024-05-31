import { Router } from "express";
import * as bodyParser from "body-parser";
import cors from "cors";
import { getConfigFile } from "medusa-core-utils";

import middlewares from "../middleware";
import { WhatsappInterfaceOptions } from "../../services/whatsapp";
import { ConfigModule, Logger } from "@medusajs/medusa/dist/types/global";
import whatsappReceiveHandler from "./whastapp-route-handler";
import whatsappConversationPreHookHandler from "./whastapp-conversation-prehook-handler";
import whatsappConversationPostHookHandler from "./whastapp-conversation-posthook-handler";

import session from "express-session";
import redis, { Redis } from "ioredis";

const whatsAppMessageRouter = Router();

export default (
  app: Router,
  options: WhatsappInterfaceOptions,
  configModule: ConfigModule
): Router => {
  const whatsappPath = "/received";
  const whatsappConversationPreHookPath = "/prepare";
  const whatsappConversationPostActionPath = "/do";
  app.use("/whatsapp", whatsAppMessageRouter);

  const corsOptions = {
    origin: "https://api.twilio.com",
    credentials: true,
  };
  if (process.env.NODE_ENV != "test") {
    whatsAppMessageRouter.options(whatsappPath, cors(corsOptions));
    whatsAppMessageRouter.post(whatsappPath, cors(corsOptions));
  }
  let sameSite: string | boolean = false;
  let secure = false;
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "staging"
  ) {
    secure = true;
    sameSite = "none";
  }

  whatsAppMessageRouter.use(
    session({
      secret: process.env.TWILIO_COOKIE_SECRET || process.env.COOKIE_SECRET,
      cookie: {
        sameSite,
        secure,
        maxAge: 3 * 60 * 1000,
      },
      store: process.env.REDIS_URL
        ? new Redis(process.env.REDIS_URL, {
            name: "whatsapp.sid",
            keyPrefix: "whtsp_",
          })
        : undefined,
    })
  );
  whatsAppMessageRouter.post(
    whatsappPath,
    (req, res, next) => {
      try {
        const logger = req.scope.resolve("logger") as Logger;
        logger.debug("received whatsapp message");
      } catch (e) {
        // included for testing
      }
      next();
    },
    bodyParser.text(),
    bodyParser.urlencoded(),
    bodyParser.json(),
    bodyParser.json(),
    middlewares.verifyTwilioHeader(options, `/whatsapp${whatsappPath}`),
    whatsappReceiveHandler
  );
  whatsAppMessageRouter.post(
    whatsappConversationPreHookPath,
    (req, res, next) => {
      try {
        const logger = req.scope.resolve("logger") as Logger;
        logger.debug("received whatsapp conversation prehook message");
        next();
      } catch (e) {
        // included for testing
      }
    },
    bodyParser.text(),
    bodyParser.urlencoded(),
    bodyParser.json(),
    bodyParser.json(),
    middlewares.verifyTwilioHeader(
      options,
      `/whatsapp${whatsappConversationPreHookPath}`
    ),
    whatsappConversationPreHookHandler
  );
  whatsAppMessageRouter.post(
    whatsappConversationPostActionPath,
    (req, res, next) => {
      try {
        const logger = req.scope.resolve("logger") as Logger;
        logger.debug("received whatsapp conversation posthook message");
        next();
      } catch (e) {
        // included for testing
      }
    },
    bodyParser.text(),
    bodyParser.urlencoded(),
    bodyParser.json(),
    bodyParser.json(),
    middlewares.verifyTwilioHeader(
      options,
      `/whatsapp${whatsappConversationPostActionPath}`
    ),
    whatsappConversationPostHookHandler
  );
  return whatsAppMessageRouter;
};
