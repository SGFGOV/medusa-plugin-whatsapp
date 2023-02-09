import { Router } from "express";
import whatsAppReceiverRoute from "./routes";
import { WhatsappInterfaceOptions } from "../services/whatsapp-interface";
/* TODO second argument pluginConfig: Record<string, unknown> part of PR https://github.com/medusajs/medusa/pull/959 not yet in master */
export default (
  rootDirectory: string,
  options: WhatsappInterfaceOptions,
  config
): Router => {
  const whatsAppRouter = Router();

  whatsAppReceiverRoute(whatsAppRouter, options, config);

  return whatsAppRouter;
};
