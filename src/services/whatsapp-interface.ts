import { EventBusService, TransactionBaseService } from "@medusajs/medusa";
import { Logger, MedusaContainer } from "@medusajs/medusa/dist/types/global";
import { default as twilio } from "twilio";
import { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import { EntityManager } from "typeorm";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import { MessageListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/message";
import { Client } from "twilio/lib/twiml/VoiceResponse";
export interface WhatsappInterfaceServiceParams {
  manager: EntityManager;
  eventBusService: EventBusService;
  logger: Logger;
}

export type WhatsappHandlerInterface<T> = {
  whatsappHandler: (
    scope: MedusaContainer,
    body: T
  ) => Promise<MessagingResponse>;
};

export interface WhatsappInterfaceOptions<T> {
  account_sid: string;
  auth_token: string;
  whatsappHandlerInterface: WhatsappHandlerInterface<T>;
}

export type ErrorCallBack = (error: Error | null, item: MessageInstance) => any;

export class WhatsappInterfaceService extends TransactionBaseService {
  logger: Logger;
  protected manager_: EntityManager;
  protected transactionManager_: EntityManager;
  eventBusService: EventBusService;
  twilioClient: twilio.Twilio;
  options: WhatsappInterfaceOptions<unknown>;
  constructor(
    container: WhatsappInterfaceServiceParams,
    options: WhatsappInterfaceOptions<unknown>
  ) {
    super(container);
    this.manager_ = container.manager;
    this.eventBusService = container.eventBusService;
    this.twilioClient = twilio(options.account_sid, options.auth_token);
    this.options = options;
    this.logger = container.logger;
  }

  withTransaction(transactionManager?: EntityManager): this {
    if (!transactionManager) {
      return this;
    }

    this.transactionManager_ = transactionManager;
    const cloned = new WhatsappInterfaceService(
      {
        manager: transactionManager,
        eventBusService: this.eventBusService,
        logger: this.logger,
      },
      this.options
    );

    return cloned as this;
  }

  async processReceivedMessage(
    scope: MedusaContainer,
    body: unknown
  ): Promise<MessagingResponse> {
    const result = await this.options.whatsappHandlerInterface.whatsappHandler(
      scope,
      body
    );
    await this.atomicPhase_(async (manager) => {
      return await this.eventBusService
        .withTransaction(manager)
        .emit("medusa.whatsapp.message.replied", result.toString());
    });

    return result;
  }

  async sendTextMessage(
    sender: string,
    receiver: string,
    message: string,
    otherOptions?: MessageListInstanceCreateOptions,
    error?: ErrorCallBack
  ): Promise<MessageInstance | undefined> {
    const basicRequest = {
      from: `whatsapp:${sender}`,
      body: `${message}`,
      to: `whatsapp:${receiver}`,
    };
    const request = otherOptions
      ? {
          ...otherOptions,
          ...basicRequest,
        }
      : basicRequest;
    try {
      const whatsappMessage = await this.twilioClient.messages.create(
        request,
        error
      );
      return whatsappMessage;
    } catch (e) {
      this.logger.log(e.message);
    }
  }
}
