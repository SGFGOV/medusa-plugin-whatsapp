import { Router } from "express";
import whatsAppReceiverRoute from "./routes";
import { WhatsappInterfaceOptions } from "../services/whatsapp";
import { ConfigModule } from "@medusajs/medusa/dist/types/global";
import { getConfigFile } from "medusa-core-utils";
/* TODO second argument pluginConfig: Record<string, unknown> part of PR https://github.com/medusajs/medusa/pull/959 not yet in master */
export default (
  rootDirectory: string,
  options: WhatsappInterfaceOptions,
  config
): Router => {
  const whatsAppRouter = Router();
  if (!config) {
    /** to support standard @medusajs/medusa */
    const { configModule } = getConfigFile(rootDirectory, "medusa-config");
    config = configModule as ConfigModule;
  }

  whatsAppReceiverRoute(whatsAppRouter, options, config);

  return whatsAppRouter;
};
