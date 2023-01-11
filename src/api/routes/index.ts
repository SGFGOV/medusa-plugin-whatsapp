import { Router } from "express";
import * as bodyParser from "body-parser";
import cors from "cors";
import { getConfigFile } from "medusa-core-utils";

import middlewares from "../middleware";
import { WhatsappInterfaceOptions } from "../../services/whatsapp-interface";

const route = Router();

export default (
  app: Router,
  rootDirectory: string,
  options: WhatsappInterfaceOptions
): Router => {
  const whatsappPath = "/whatsapp-message";
  app.use(whatsappPath, route);

  const corsOptions = {
    origin: "https://api.twilio.com",
    credentials: true,
  };

  route.options(whatsappPath, cors(corsOptions));
  // route.options(whatsappPath, middlewares.verifyTwilioHeader);
  route.post(whatsappPath, middlewares.verifyTwilioHeader(options));
  route.post(
    whatsappPath,
    cors(corsOptions),
    bodyParser.json(),
    middlewares.wrap(require("whatsapp-route-handle").default)
  );
  return app;
};
