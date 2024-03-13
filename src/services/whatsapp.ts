/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  AbstractNotificationService,
  CartService,
  ClaimService,
  EventBusService,
  Fulfillment,
  FulfillmentProviderService,
  FulfillmentService,
  GiftCardService,
  LineItem,
  LineItemService,
  Order,
  OrderService,
  ProductVariantService,
  ReturnService,
  ShippingMethod,
  StoreService,
  SwapService,
  TotalsService,
} from "@medusajs/medusa";
import { Logger, MedusaContainer } from "@medusajs/medusa/dist/types/global";
import twilio from "twilio";

import { EntityManager } from "typeorm";
import MessagingResponse from "twilio/lib/twiml/MessagingResponse";
import {
  MessageInstance,
  MessageListInstanceCreateOptions,
} from "twilio/lib/rest/api/v2010/account/message";
import { humanizeAmount, zeroDecimalCurrencies } from "medusa-core-utils";
import { WhatsappConversation, WhatsappSession } from "../types";
import { ConversationInstance } from "twilio/lib/rest/conversations/v1/conversation";
import { ParticipantInstance } from "twilio/lib/rest/conversations/v1/conversation/participant";
import { MessageInstance as ConversationMessageInstance } from "twilio/lib/rest/conversations/v1/conversation/message";
import { error } from "console";
import { ContentInstance } from "twilio/lib/rest/content/v1/content";

export interface WhatsappInterfaceServiceParams {
  manager: EntityManager;
  eventBusService: EventBusService;
  logger: Logger;
  storeService: StoreService;
  orderService: OrderService;
  returnService: ReturnService;
  swapService: SwapService;
  cartService: CartService;
  lineItemService: LineItemService;
  claimService: ClaimService;
  fulfillmentService: FulfillmentService;
  fulfillmentProviderService: FulfillmentProviderService;
  totalsService: TotalsService;
  productVariantService: ProductVariantService;
  giftCardService: GiftCardService;
  [key: string]: unknown; // Add this line
}

export interface WhatsappHandlerInterface<T> {
  whatsappHandler: (
    container: MedusaContainer,
    body: T,
    activeSession: WhatsappSession
  ) => Promise<MessagingResponse>;
  whatsappConversationPrehookHandler: (
    container: MedusaContainer,
    body: T,
    activeSession?: WhatsappSession
  ) => Promise<
    | {
        body?: string;
        author?: string;
        attributes?: Record<string, string>;
      }
    | { friendly_name?: string }
  >;
  whatsappConversationPosthookHandler?: (
    container: MedusaContainer,
    body: T,
    activeSession?: WhatsappSession
  ) => Promise<
    | {
        body?: string;
        author?: string;
        attributes?: Record<string, string>;
      }
    | { friendly_name?: string }
  >;
}

export interface WhatsappInterfaceOptions {
  account_sid: string;
  auth_token: string;
  whatsappHandlerInterface: string;
  medusaServerHost: string;
  medusaServerPort: string;
  medusaServerProtocol: string;
}

export type ErrorCallBack = (error: Error | null, item: MessageInstance) => any;

export class WhatsappService extends AbstractNotificationService {
  logger_: Logger;
  protected manager_: EntityManager;
  protected transactionManager_: EntityManager;
  eventBusService: EventBusService;
  twilioClient: twilio.Twilio;
  options: WhatsappInterfaceOptions;
  static identifier = "whatsapp";
  fulfillmentProviderService_: FulfillmentProviderService;
  storeService_: StoreService;
  lineItemService_: LineItemService;
  orderService_: OrderService;
  cartService_: CartService;
  claimService_: ClaimService;
  returnService_: ReturnService;
  swapService_: SwapService;
  fulfillmentService_: FulfillmentService;
  totalsService_: TotalsService;
  productVariantService_: ProductVariantService;
  giftCardService_: GiftCardService;

  constructor(
    container: WhatsappInterfaceServiceParams,
    options: WhatsappInterfaceOptions
  ) {
    super(container);
    this.manager_ = container.manager;
    this.eventBusService = container.eventBusService;
    this.twilioClient = twilio(options.account_sid, options.auth_token);
    this.options = options;
    this.logger_ = container.logger;
    this.id = "whatsapp";
    this.is_installed = true;
    this.fulfillmentProviderService_ = container.fulfillmentProviderService;
    this.storeService_ = container.storeService;
    this.lineItemService_ = container.lineItemService;
    this.orderService_ = container.orderService;
    this.cartService_ = container.cartService;
    this.claimService_ = container.claimService;
    this.returnService_ = container.returnService;
    this.swapService_ = container.swapService;
    this.fulfillmentService_ = container.fulfillmentService;
    this.totalsService_ = container.totalsService;
    this.productVariantService_ = container.productVariantService;
    this.giftCardService_ = container.giftCardService;
  }
  id: string;
  is_installed: boolean;

  withTransaction(transactionManager?: EntityManager): this {
    if (!transactionManager) {
      return this;
    }

    this.transactionManager_ = transactionManager;
    const cloned = new WhatsappService(
      {
        manager: transactionManager,
        eventBusService: this.eventBusService,
        logger: this.logger_,
        storeService: this.storeService_,
        swapService: this.swapService_,
        orderService: this.orderService_,
        fulfillmentProviderService: this.fulfillmentProviderService_,
        fulfillmentService: this.fulfillmentService_,
        totalsService: this.totalsService_,
        productVariantService: this.productVariantService_,
        giftCardService: this.giftCardService_,
        cartService: this.cartService_,
        lineItemService: this.lineItemService_,
        claimService: this.claimService_,
        returnService: this.returnService_,
      },
      this.options
    );

    return cloned as this;
  }

  async processReceivedMessage<T>(
    container: MedusaContainer,
    body: T,
    activeSession: WhatsappSession
  ): Promise<MessagingResponse> {
    const whatsappHandler = container.resolve(
      this.options.whatsappHandlerInterface
    ) as WhatsappHandlerInterface<T>;
    const result = await whatsappHandler.whatsappHandler(
      container,
      body,
      activeSession
    );
    await this.atomicPhase_(async (manager) => {
      return await this.eventBusService
        .withTransaction(manager)
        .emit("medusa.whatsapp.message.replied", result.toString());
    });

    return result;
  }
  async processReceivedConversationPrehook<T>(
    container: MedusaContainer,
    body: T
  ): Promise<
    | {
        body?: string;
        author?: string;
        attributes?: Record<string, string>;
      }
    | { friendly_name?: string }
  > {
    const whatsappHandler = container.resolve(
      this.options.whatsappHandlerInterface
    ) as WhatsappHandlerInterface<T>;
    if (whatsappHandler.whatsappConversationPrehookHandler) {
      const result = await whatsappHandler.whatsappConversationPrehookHandler(
        container,
        body
      );
      // await this.atomicPhase_(async (manager) => {
      //   return await this.eventBusService
      //     .withTransaction(manager)
      //     .emit(
      //       "medusa.whatsapp.converation.prehook.replied",
      //       result.toString()
      //     );
      // });

      return result;
    } else {
      this.logger_.error("conversation prehook not configured");
    }
  }
  async processReceivedConversationPosthook<T>(
    container: MedusaContainer,
    body: T
  ): Promise<
    | {
        body?: string;
        author?: string;
        attributes?: Record<string, string>;
      }
    | { friendly_name?: string }
  > {
    const whatsappHandler = container.resolve(
      this.options.whatsappHandlerInterface
    ) as WhatsappHandlerInterface<T>;
    if (whatsappHandler.whatsappConversationPosthookHandler) {
      const result = await whatsappHandler.whatsappConversationPosthookHandler(
        container,
        body
      );
      await this.atomicPhase_(async (manager) => {
        return await this.eventBusService
          .withTransaction(manager)
          .emit(
            "medusa.whatsapp.conversation.posthook.replied",
            result.toString()
          );
      });

      return result;
    } else {
      this.logger_.error("conversation posthook not configured");
    }
  }
  /**
   *
   * @param sender - senders phone number in iso format "eg: +1xxxxxxxx"
   * @param receiver - receiver phone number in iso format "eg: +1xxxxxxxx"
   * @param message - the text message
   * @param otherOptions - other twilio params
   * @param error  an error call back
   * @returns
   */

  async sendTextMessage(
    sender: string,
    receiver: string,
    message: string,
    otherOptions?: MessageListInstanceCreateOptions,
    error?: ErrorCallBack
  ): Promise<MessageInstance> {
    let quickResponse: Record<string, any>;
    try {
      quickResponse = JSON.parse(message);
      if (quickResponse.contentSid) {
        quickResponse = {
          ...quickResponse,
          body: undefined,
        };
      }
      this.logger_.debug(`received ${JSON.stringify(quickResponse)}`);
    } catch (e) {
      this.logger_.warn("Non JSON message fromat receied");
    }
    const basicRequest = {
      from: `whatsapp:${sender}`,
      body: `${message}`,
      to: `whatsapp:${receiver}`,
    };
    if (quickResponse) {
      delete basicRequest.body;
    }
    const request = otherOptions
      ? {
          ...otherOptions,
          ...basicRequest,
          ...quickResponse,
        }
      : basicRequest;
    try {
      this.logger_.debug(`twilio request ${JSON.stringify(request)}`);
      const whatsappMessage = await this.twilioClient.messages.create(
        request,
        error
      );
      return whatsappMessage;
    } catch (e) {
      this.logger_.log(e.message);
    }
  }
  async sendNotification(
    event: string,
    data: { sender: string; receiver: string; message?: string } & Record<
      string,
      unknown
    >,
    attachmentGenerator: any
  ): Promise<{ to: string; status: string; data: Record<string, unknown> }> {
    const { sender, receiver, message, ...rest } = data;
    let messageExtraData;
    if (!sender || !receiver) {
      return;
    }
    if (!message) {
      messageExtraData = await this.fetchData(event, data, attachmentGenerator);
    }

    const msg = message ?? JSON.stringify(messageExtraData);
    await this.sendTextMessage(sender, receiver, msg);

    return {
      to: data.sender,
      status: "200",
      data: { ...data, message: msg },
    };
  }
  async resendNotification(
    notification: any,
    config: any,
    attachmentGenerator: any
  ): Promise<{ to: string; status: string; data: Record<string, unknown> }> {
    const sendOptions = {
      data: notification.data,
      to: config.to || notification.to,
      from: config.from || notification.from,
    };

    await this.sendTextMessage(
      sendOptions.data.sender,
      sendOptions.data.receiver,
      sendOptions.data.message
    );

    const data = {
      sender: sendOptions.data.sender,
      reciever: sendOptions.data.receiver,
      message: sendOptions.data.message,
    };

    return {
      to: sendOptions.data.sender,
      status: "200",
      data,
    };
  }
  async fetchAttachments(
    event: any,
    data: {
      return_request: {
        items?: LineItem[];
        shipping_method?: ShippingMethod;
        shipping_data?: any;
      };
      order: Order;
    },
    attachmentGenerator: { createReturnInvoice: (arg0: any, arg1: any) => any }
  ) {
    switch (event) {
      case "swap.created":
      case "order.return_requested": {
        let attachments = [];
        const { shipping_method, shipping_data } = data.return_request;
        if (shipping_method) {
          const provider = shipping_method.shipping_option.provider_id;

          const lbl = await this.fulfillmentProviderService_.retrieveDocuments(
            provider,
            shipping_data,
            "label"
          );

          attachments = attachments.concat(
            lbl.map((d) => ({
              name: "return-label",
              base64: d.base_64,
              type: d.type,
            }))
          );
        }

        if (attachmentGenerator && attachmentGenerator.createReturnInvoice) {
          const base64 = await attachmentGenerator.createReturnInvoice(
            data.order,
            data.return_request.items
          );
          attachments.push({
            name: "invoice",
            base64,
            type: "application/pdf",
          });
        }

        return attachments;
      }
      default:
        return [];
    }
  }

  async fetchData(event, eventData: any, attachmentGenerator) {
    switch (event) {
      case "order.return_requested":
        return this.returnRequestedData(eventData);
      case "swap.shipment_created":
        return this.swapShipmentCreatedData(eventData);
      case "claim.shipment_created":
        return this.claimShipmentCreatedData(eventData);
      case "order.items_returned":
        return this.itemsReturnedData(eventData);
      case "swap.received":
        return this.swapReceivedData(eventData);
      case "swap.created":
        return this.swapCreatedData(eventData);
      case "gift_card.created":
        return this.gcCreatedData(eventData);
      case "order.gift_card_created":
        return this.gcCreatedData(eventData);
      case "order.placed":
        return this.orderPlacedData(eventData);
      case "order.shipment_created":
        return this.orderShipmentCreatedData(eventData, attachmentGenerator);
      case "order.canceled":
        return this.orderCanceledData(eventData);
      case "user.password_reset":
        return this.userPasswordResetData(eventData);
      case "customer.password_reset":
        return this.customerPasswordResetData(eventData);
      case "restock-notification.restocked":
        return await this.restockNotificationData(eventData);
      case "order.refund_created":
        return this.orderRefundCreatedData(eventData);
      default:
        return { ...eventData };
    }
  }
  async orderShipmentCreatedData({ id, fulfillment_id }, attachmentGenerator) {
    const order = await this.orderService_.retrieve(id, {
      select: [
        "shipping_total",
        "discount_total",
        "tax_total",
        "refunded_total",
        "gift_card_total",
        "subtotal",
        "total",
        "refundable_amount",
      ],
      relations: [
        "customer",
        "billing_address",
        "shipping_address",
        "discounts",
        "discounts.rule",
        "shipping_methods",
        "shipping_methods.shipping_option",
        "payments",
        "fulfillments",
        "returns",
        "gift_cards",
        "gift_card_transactions",
      ],
    });

    const shipment = await this.atomicPhase_(async (manager) => {
      const fulfillmentRepo = manager.getRepository(Fulfillment);
      const fulfilment = await fulfillmentRepo.findOne({
        where: {
          id: fulfillment_id,
        },
        relations: ["items", "tracking_links"],
      });
      return fulfilment;
    });

    const locale = await this.extractLocale(order);

    return {
      locale,
      order,
      date: shipment.shipped_at.toDateString(),
      email: order.email,
      fulfillment: shipment,
      tracking_links: shipment.tracking_links,
      tracking_number: shipment.tracking_numbers.join(", "),
    };
  }

  async orderCanceledData({ id }) {
    const order = await this.orderService_.retrieve(id, {
      select: [
        "shipping_total",
        "discount_total",
        "tax_total",
        "refunded_total",
        "gift_card_total",
        "subtotal",
        "total",
      ],
      relations: [
        "customer",
        "billing_address",
        "shipping_address",
        "discounts",
        "discounts.rule",
        "shipping_methods",
        "shipping_methods.shipping_option",
        "payments",
        "fulfillments",
        "returns",
        "gift_cards",
        "gift_card_transactions",
      ],
    });

    const {
      subtotal,
      tax_total,
      discount_total,
      shipping_total,
      gift_card_total,
      total,
    } = order;

    const taxRate = order.tax_rate / 100;
    const currencyCode = order.currency_code.toUpperCase();

    const items = this.processItems_(order.items, taxRate, currencyCode);

    let discounts = [];
    if (order.discounts) {
      discounts = order.discounts.map((discount) => {
        return {
          is_giftcard: false,
          code: discount.code,
          descriptor: `${discount.rule.value}${
            discount.rule.type === "percentage" ? "%" : ` ${currencyCode}`
          }`,
        };
      });
    }

    let giftCards = [];
    if (order.gift_cards) {
      giftCards = order.gift_cards.map((gc) => {
        return {
          is_giftcard: true,
          code: gc.code,
          descriptor: `${gc.value} ${currencyCode}`,
        };
      });

      discounts.concat(giftCards);
    }

    const locale = await this.extractLocale(order);

    return {
      ...order,
      locale,
      has_discounts: order.discounts.length,
      has_gift_cards: order.gift_cards.length,
      date: order.created_at.toDateString(),
      items,
      discounts,
      subtotal: `${this.humanPrice_(
        subtotal * (1 + taxRate),
        currencyCode
      )} ${currencyCode}`,
      gift_card_total: `${this.humanPrice_(
        gift_card_total * (1 + taxRate),
        currencyCode
      )} ${currencyCode}`,
      tax_total: `${this.humanPrice_(tax_total, currencyCode)} ${currencyCode}`,
      discount_total: `${this.humanPrice_(
        discount_total * (1 + taxRate),
        currencyCode
      )} ${currencyCode}`,
      shipping_total: `${this.humanPrice_(
        shipping_total * (1 + taxRate),
        currencyCode
      )} ${currencyCode}`,
      total: `${this.humanPrice_(total, currencyCode)} ${currencyCode}`,
    };
  }

  async orderPlacedData({ id }) {
    const order = await this.orderService_.retrieve(id, {
      select: [
        "shipping_total",
        "discount_total",
        "tax_total",
        "refunded_total",
        "gift_card_total",
        "subtotal",
        "total",
      ],
      relations: [
        "customer",
        "billing_address",
        "shipping_address",
        "discounts",
        "discounts.rule",
        "shipping_methods",
        "shipping_methods.shipping_option",
        "payments",
        "fulfillments",
        "returns",
        "gift_cards",
        "gift_card_transactions",
      ],
    });

    const { tax_total, shipping_total, gift_card_total, total } = order;

    const currencyCode = order.currency_code.toUpperCase();

    const items = await Promise.all(
      order.items.map(
        async (
          i: LineItem & {
            totals: { original_total: number; total: number; subtotal };
            discounted_price: string;
            price: string;
          }
        ) => {
          i.totals = await this.totalsService_.getLineItemTotals(i, order, {
            include_tax: true,
            use_tax_lines: true,
          });
          i.thumbnail = this.normalizeThumbUrl_(i.thumbnail);
          i.discounted_price = `${this.humanPrice_(
            i.totals.total / i.quantity,
            currencyCode
          )} ${currencyCode}`;
          i.price = `${this.humanPrice_(
            i.totals.original_total / i.quantity,
            currencyCode
          )} ${currencyCode}`;
          return i;
        }
      )
    );

    let discounts = [];
    if (order.discounts) {
      discounts = order.discounts.map((discount) => {
        return {
          is_giftcard: false,
          code: discount.code,
          descriptor: `${discount.rule.value}${
            discount.rule.type === "percentage" ? "%" : ` ${currencyCode}`
          }`,
        };
      });
    }

    let giftCards = [];
    if (order.gift_cards) {
      giftCards = order.gift_cards.map((gc) => {
        return {
          is_giftcard: true,
          code: gc.code,
          descriptor: `${gc.value} ${currencyCode}`,
        };
      });

      discounts.concat(giftCards);
    }

    const locale = await this.extractLocale(order);

    // Includes taxes in discount amount
    const discountTotal = items.reduce((acc, i) => {
      return acc + i.totals.original_total - i.totals.total;
    }, 0);

    const discounted_subtotal = items.reduce((acc, i) => {
      return acc + i.totals.total;
    }, 0);
    const subtotal = items.reduce((acc, i) => {
      return acc + i.totals.original_total;
    }, 0);

    const subtotal_ex_tax = items.reduce((total, i) => {
      return total + i.totals.subtotal;
    }, 0);

    return {
      ...order,
      locale,
      has_discounts: order.discounts.length,
      has_gift_cards: order.gift_cards.length,
      date: order.created_at.toDateString(),
      items,
      discounts,
      subtotal_ex_tax: `${this.humanPrice_(
        subtotal_ex_tax,
        currencyCode
      )} ${currencyCode}`,
      subtotal: `${this.humanPrice_(subtotal, currencyCode)} ${currencyCode}`,
      gift_card_total: `${this.humanPrice_(
        gift_card_total,
        currencyCode
      )} ${currencyCode}`,
      tax_total: `${this.humanPrice_(tax_total, currencyCode)} ${currencyCode}`,
      discount_total: `${this.humanPrice_(
        discountTotal,
        currencyCode
      )} ${currencyCode}`,
      shipping_total: `${this.humanPrice_(
        shipping_total,
        currencyCode
      )} ${currencyCode}`,
      total: `${this.humanPrice_(total, currencyCode)} ${currencyCode}`,
    };
  }

  async gcCreatedData({ id }) {
    const giftCard = await this.giftCardService_.retrieve(id, {
      relations: ["region", "order"],
    });
    const taxRate = giftCard.region.tax_rate / 100;
    const locale = giftCard.order
      ? await this.extractLocale(giftCard.order)
      : null;
    const email = giftCard.order
      ? giftCard.order.email
      : giftCard.metadata.email;

    return {
      ...giftCard,
      locale,
      email,
      display_value: `${this.humanPrice_(
        giftCard.value * 1 + taxRate,
        giftCard.region.currency_code
      )} ${giftCard.region.currency_code}`,
      message:
        giftCard.metadata?.message || giftCard.metadata?.personal_message,
    };
  }

  async returnRequestedData({ id, return_id }) {
    // Fetch the return request
    const returnRequest = await this.returnService_.retrieve(return_id, {
      relations: [
        "items.item.tax_lines",
        "items.item.variant.product.profiles",
        "shipping_method",
        "shipping_method.tax_lines",
        "shipping_method.shipping_option",
      ],
    });

    const items = await this.lineItemService_.list(
      {
        id: returnRequest.items.map(({ item_id }) => item_id),
      },
      {
        relations: ["tax_lines", "variant", "variant.product.profiles"],
      }
    );

    // Fetch the order
    const order = await this.orderService_.retrieve(id, {
      select: ["total"],
      relations: [
        "items",
        "items.variant",
        "items.tax_lines",
        "discounts",
        "discounts.rule",
        "shipping_address",
        "returns",
      ],
    });

    const currencyCode = order.currency_code.toUpperCase();

    // Calculate which items are in the return
    const returnItems = await Promise.all(
      returnRequest.items.map(async (i) => {
        const found = items.find((oi) => oi.id === i.item_id);
        found.quantity = i.quantity;
        found.thumbnail = this.normalizeThumbUrl_(found.thumbnail);
        found["totals"] = await this.totalsService_.getLineItemTotals(
          found,
          order,
          {
            include_tax: true,
            use_tax_lines: true,
          }
        );
        found["price"] = `${this.humanPrice_(
          found["totals"].total,
          currencyCode
        )} ${currencyCode}`;
        found.tax_lines = found["totals"].tax_lines;
        return found;
      })
    );

    // Get total of the returned products
    const item_subtotal = returnItems.reduce(
      (acc, next: any) => acc + next.totals.total,
      0
    );

    // If the return has a shipping method get the price and any attachments
    let shippingTotal = 0;
    if (returnRequest.shipping_method) {
      const base = returnRequest.shipping_method.price;
      shippingTotal =
        base +
        returnRequest.shipping_method.tax_lines.reduce((acc, next) => {
          return Math.round(acc + base * (next.rate / 100));
        }, 0);
    }

    const locale = await this.extractLocale(order);

    return {
      locale,
      has_shipping: !!returnRequest.shipping_method,
      email: order.email,
      items: returnItems,
      subtotal: `${this.humanPrice_(
        item_subtotal,
        currencyCode
      )} ${currencyCode}`,
      shipping_total: `${this.humanPrice_(
        shippingTotal,
        currencyCode
      )} ${currencyCode}`,
      refund_amount: `${this.humanPrice_(
        returnRequest.refund_amount,
        currencyCode
      )} ${currencyCode}`,
      return_request: {
        ...returnRequest,
        refund_amount: `${this.humanPrice_(
          returnRequest.refund_amount,
          currencyCode
        )} ${currencyCode}`,
      },
      order,
      date: returnRequest.updated_at.toDateString(),
    };
  }

  async swapReceivedData({ id }) {
    const store = await this.storeService_.retrieve();

    const swap = await this.swapService_.retrieve(id, {
      relations: [
        "additional_items",
        "additional_items.tax_lines",
        "additional_items.variant",
        "return_order",
        "return_order.items",
        "return_order.items.item",
        "return_order.items.item.variant",
        "return_order.shipping_method",
        "return_order.shipping_method.shipping_option",
      ],
    });

    const returnRequest = swap.return_order;
    const items = await this.lineItemService_.list(
      {
        id: returnRequest.items.map(({ item_id }) => item_id),
      },
      {
        relations: ["tax_lines"],
      }
    );

    returnRequest.items = returnRequest.items.map((item) => {
      const found = items.find((i) => i.id === item.item_id);
      return {
        ...item,
        item: found,
      };
    });

    const swapLink = store.swap_link_template.replace(
      /\{cart_id\}/,
      swap.cart_id
    );

    const order = await this.orderService_.retrieve(swap.order_id, {
      select: ["total"],
      relations: [
        "items",
        "items.variant",
        "discounts",
        "discounts.rule",
        "shipping_address",
        "swaps",
        "swaps.additional_items",
        "swaps.additional_items.tax_lines",
        "swaps.additional_items.variant",
      ],
    });

    const cart = await this.cartService_.retrieve(swap.cart_id, {
      relations: ["items.variant.product.profiles"],
      select: [
        "total",
        "tax_total",
        "discount_total",
        "shipping_total",
        "subtotal",
      ],
    });

    const currencyCode = order.currency_code.toUpperCase();
    const decoratedItems = await Promise.all(
      cart.items.map(async (i) => {
        const totals = await this.totalsService_.getLineItemTotals(i, cart, {
          include_tax: true,
        });

        return {
          ...i,
          totals,
          price: this.humanPrice_(
            totals.subtotal + totals.tax_total,
            currencyCode
          ),
        };
      })
    );

    const returnTotal = decoratedItems.reduce((acc, next) => {
      if (next.is_return) {
        return acc + -1 * (next.totals.subtotal + next.totals.tax_total);
      }
      return acc;
    }, 0);

    const additionalTotal = decoratedItems.reduce((acc, next) => {
      if (!next.is_return) {
        return acc + next.totals.subtotal + next.totals.tax_total;
      }
      return acc;
    }, 0);

    const refundAmount = swap.return_order.refund_amount;

    const locale = await this.extractLocale(order);

    return {
      locale,
      swap,
      order,
      return_request: returnRequest,
      date: swap.updated_at.toDateString(),
      swap_link: swapLink,
      email: order.email,
      items: decoratedItems.filter((di) => !di.is_return),
      return_items: decoratedItems.filter((di) => di.is_return),
      return_total: `${this.humanPrice_(
        returnTotal,
        currencyCode
      )} ${currencyCode}`,
      tax_total: `${this.humanPrice_(
        cart.total,
        currencyCode
      )} ${currencyCode}`,
      refund_amount: `${this.humanPrice_(
        refundAmount,
        currencyCode
      )} ${currencyCode}`,
      additional_total: `${this.humanPrice_(
        additionalTotal,
        currencyCode
      )} ${currencyCode}`,
    };
  }

  async swapCreatedData({ id }) {
    const store = await this.storeService_.retrieve(id);
    const swap = await this.swapService_.retrieve(id, {
      relations: [
        "additional_items.variant.product.profiles",
        "additional_items.tax_lines",
        "return_order",
        "return_order.items",
        "return_order.items.item",
        "return_order.shipping_method",
        "return_order.shipping_method.shipping_option",
      ],
    });

    const returnRequest = swap.return_order;

    const items = await this.lineItemService_.list(
      {
        id: returnRequest.items.map(({ item_id }) => item_id),
      },
      {
        relations: ["tax_lines", "variant.product.profiles"],
      }
    );

    returnRequest.items = returnRequest.items.map((item) => {
      const found = items.find((i) => i.id === item.item_id);
      return {
        ...item,
        item: found,
      };
    });

    const swapLink = store.swap_link_template.replace(
      /\{cart_id\}/,
      swap.cart_id
    );

    const order = await this.orderService_.retrieve(swap.order_id, {
      select: ["total"],
      relations: [
        "items.variant.product.profiles",
        "items.tax_lines",
        "discounts",
        "discounts.rule",
        "shipping_address",
        "swaps",
        "swaps.additional_items",
        "swaps.additional_items.tax_lines",
        "swaps.additional_items.variant",
      ],
    });

    const cart = await this.cartService_.retrieve(swap.cart_id, {
      select: [
        "total",
        "tax_total",
        "discount_total",
        "shipping_total",
        "subtotal",
      ],
      relations: ["items.variant.product.profiles"],
    });
    const currencyCode = order.currency_code.toUpperCase();

    const decoratedItems = await Promise.all(
      cart.items.map(async (i) => {
        const totals = await this.totalsService_.getLineItemTotals(i, cart, {
          include_tax: true,
        });

        return {
          ...i,
          totals,
          tax_lines: totals.tax_lines,
          price: `${this.humanPrice_(
            totals.original_total / i.quantity,
            currencyCode
          )} ${currencyCode}`,
          discounted_price: `${this.humanPrice_(
            totals.total / i.quantity,
            currencyCode
          )} ${currencyCode}`,
        };
      })
    );

    const returnTotal = decoratedItems.reduce((acc, next) => {
      const { total } = next.totals;
      if (next.is_return && next.variant_id) {
        return acc + -1 * total;
      }
      return acc;
    }, 0);

    const additionalTotal = decoratedItems.reduce((acc, next) => {
      const { total } = next.totals;
      if (!next.is_return) {
        return acc + total;
      }
      return acc;
    }, 0);

    const refundAmount = swap.return_order.refund_amount;

    const locale = await this.extractLocale(order);

    return {
      locale,
      swap,
      order,
      return_request: returnRequest,
      date: swap.updated_at.toDateString(),
      swap_link: swapLink,
      email: order.email,
      items: decoratedItems.filter((di) => !di.is_return),
      return_items: decoratedItems.filter((di) => di.is_return),
      return_total: `${this.humanPrice_(
        returnTotal,
        currencyCode
      )} ${currencyCode}`,
      refund_amount: `${this.humanPrice_(
        refundAmount,
        currencyCode
      )} ${currencyCode}`,
      additional_total: `${this.humanPrice_(
        additionalTotal,
        currencyCode
      )} ${currencyCode}`,
    };
  }

  async itemsReturnedData(data) {
    return this.returnRequestedData(data);
  }

  async swapShipmentCreatedData({ id, fulfillment_id }) {
    const swap = await this.swapService_.retrieve(id, {
      relations: [
        "shipping_address",
        "shipping_methods",
        "shipping_methods.shipping_option",
        "shipping_methods.tax_lines",
        "additional_items.variant.product.profiles",
        "additional_items.tax_lines",
        "return_order",
        "return_order.items",
      ],
    });

    const order = await this.orderService_.retrieve(swap.order_id, {
      relations: [
        "region",
        "items",
        "items.tax_lines",
        "items.variant.product.profiles",
        "discounts",
        "discounts.rule",
        "swaps",
        "swaps.additional_items.variant.product.profiles",
        "swaps.additional_items.tax_lines",
      ],
    });

    const cart = await this.cartService_.retrieve(swap.cart_id, {
      select: [
        "total",
        "tax_total",
        "discount_total",
        "shipping_total",
        "subtotal",
      ],
      relations: ["items.variant.product.profiles"],
    });

    const returnRequest = swap.return_order;
    const items = await this.lineItemService_.list(
      {
        id: returnRequest.items.map(({ item_id }) => item_id),
      },
      {
        relations: ["tax_lines", "variant.product.profiles"],
      }
    );

    const taxRate = order.tax_rate / 100;
    const currencyCode = order.currency_code.toUpperCase();

    const returnItems = await Promise.all(
      swap.return_order.items.map(async (i) => {
        const found = items.find((oi) => oi.id === i.item_id);
        const totals = await this.totalsService_.getLineItemTotals(
          i.item,
          cart,
          {
            include_tax: true,
          }
        );

        return {
          ...found,
          thumbnail: this.normalizeThumbUrl_(found.thumbnail),
          price: `${this.humanPrice_(
            totals.original_total / i.quantity,
            currencyCode
          )} ${currencyCode}`,
          discounted_price: `${this.humanPrice_(
            totals.total / i.quantity,
            currencyCode
          )} ${currencyCode}`,
          quantity: i.quantity,
        };
      })
    );

    const returnTotal = await this.totalsService_.getRefundTotal(
      order,
      returnItems as any
    );

    const constructedOrder = {
      ...order,
      shipping_methods: swap.shipping_methods,
      items: swap.additional_items,
    };

    const additionalTotal = await this.totalsService_.getTotal(
      constructedOrder as any
    );

    const refundAmount = swap.return_order.refund_amount;
    const expandedOrder = await this.orderService_.retrieve(order.id, {
      relations: ["fulfilments", "fulfilments.tracking_links"],
    });

    const shipment = expandedOrder.fulfillments.find(
      (f) => f.id == fulfillment_id
    );

    const locale = await this.extractLocale(order);

    return {
      locale,
      swap,
      order,
      items: await Promise.all(
        swap.additional_items.map(async (i) => {
          const totals = await this.totalsService_.getLineItemTotals(i, cart, {
            include_tax: true,
          });

          return {
            ...i,
            thumbnail: this.normalizeThumbUrl_(i.thumbnail),
            price: `${this.humanPrice_(
              totals.original_total / i.quantity,
              currencyCode
            )} ${currencyCode}`,
            discounted_price: `${this.humanPrice_(
              totals.total / i.quantity,
              currencyCode
            )} ${currencyCode}`,
            quantity: i.quantity,
          };
        })
      ),
      date: swap.updated_at.toDateString(),
      email: order.email,
      tax_amount: `${this.humanPrice_(
        cart.tax_total,
        currencyCode
      )} ${currencyCode}`,
      paid_total: `${this.humanPrice_(
        swap.difference_due,
        currencyCode
      )} ${currencyCode}`,
      return_total: `${this.humanPrice_(
        returnTotal,
        currencyCode
      )} ${currencyCode}`,
      refund_amount: `${this.humanPrice_(
        refundAmount,
        currencyCode
      )} ${currencyCode}`,
      additional_total: `${this.humanPrice_(
        additionalTotal,
        currencyCode
      )} ${currencyCode}`,
      fulfillment: shipment,
      tracking_links: shipment.tracking_links,
      tracking_number: shipment.tracking_numbers.join(", "),
    };
  }

  async claimShipmentCreatedData({ id, fulfillment_id }) {
    const claim = await this.claimService_.retrieve(id, {
      relations: [
        "order.items.variant.product.profiles",
        "order.shipping_address",
        "order.fulfillments",
        "order.fulfillments.tracking_links",
      ],
    });

    const shipment = claim.order.fulfillments.find(
      (f) => f.id == fulfillment_id
    );

    const locale = await this.extractLocale(claim.order);

    return {
      locale,
      email: claim.order.email,
      claim,
      order: claim.order,
      fulfillment: shipment,
      tracking_links: shipment.tracking_links,
      tracking_number: shipment.tracking_numbers.join(", "),
    };
  }

  async restockNotificationData({ variant_id, emails }) {
    const variant = await this.productVariantService_.retrieve(variant_id, {
      relations: ["product"],
    });

    let thumb;
    if (variant.product.thumbnail) {
      thumb = this.normalizeThumbUrl_(variant.product.thumbnail);
    }

    return {
      product: {
        ...variant.product,
        thumbnail: thumb,
      },
      variant,
      variant_id,
      emails,
    };
  }

  userPasswordResetData(data) {
    return data;
  }

  customerPasswordResetData(data) {
    return data;
  }

  async orderRefundCreatedData({ id, refund_id }) {
    const order = await this.orderService_.retrieveWithTotals(id, {
      relations: ["refunds", "items"],
    });

    const refund = order.refunds.find((refund) => refund.id === refund_id);

    return {
      order,
      refund,
      refund_amount: `${this.humanPrice_(refund.amount, order.currency_code)} ${
        order.currency_code
      }`,
      email: order.email,
    };
  }

  processItems_(items, taxRate, currencyCode) {
    return items.map((i) => {
      return {
        ...i,
        thumbnail: this.normalizeThumbUrl_(i.thumbnail),
        price: `${this.humanPrice_(
          i.unit_price * (1 + taxRate),
          currencyCode
        )} ${currencyCode}`,
      };
    });
  }

  humanPrice_(amount, currency) {
    if (!amount) {
      return "0.00";
    }

    const normalized = humanizeAmount(amount, currency);
    return normalized.toFixed(
      zeroDecimalCurrencies.includes(currency.toLowerCase()) ? 0 : 2
    );
  }

  normalizeThumbUrl_(url) {
    if (!url) {
      return null;
    }

    if (url.startsWith("http")) {
      return url;
    } else if (url.startsWith("//")) {
      return `https:${url}`;
    }
    return url;
  }

  async extractLocale(fromOrder) {
    if (fromOrder.cart_id) {
      try {
        const cart = await this.cartService_.retrieve(fromOrder.cart_id, {
          select: ["id", "context"],
        });

        if (cart.context && cart.context.locale) {
          return cart.context.locale;
        }
      } catch (err) {
        console.log(err);
        console.warn("Failed to gather context for order");
        return null;
      }
    }
    return null;
  }
  createTemplateParameters(...args: string[]): Record<string, string> {
    const parameters = {};
    for (let index = 0; index < args.length; index++) {
      parameters[index] = args[index];
    }
    return parameters;
  }

  createTemplatedMessage({
    messageId,
    to: phone,
    parameters,
    contentSid,
  }: {
    messageId: string;
    to: string;
    parameters: Record<string, string>;
    contentSid: string;
  }): {
    id: string;
    sender: string;
    receiver: string;
    contentSid: string;
    contentVaribles: string;
  } {
    return {
      id: `msg_whatsapp_${messageId}`,
      sender: process.env.TWILIO_SMS_NUMBER,
      receiver: phone,
      contentSid: contentSid,
      contentVaribles: JSON.stringify(parameters),
    };
  }

  async sendContentTemplate({
    messageId,
    to,
    parameters,
    contentSid,
  }: {
    messageId: string;
    to: string;
    parameters: Record<string, string>;
    contentSid: string;
  }): Promise<MessageInstance> {
    const stringMessage = JSON.stringify(
      this.createTemplatedMessage({
        messageId,
        to,
        parameters,
        contentSid,
      })
    );
    try {
      const phoneResult = await this.sendTextMessage(
        process.env.TWILIO_WHATSAPP_NUMBER,
        to,
        stringMessage
      );
      return phoneResult;
    } catch (e) {
      this.logger_.error(`unable to send message ${e.message}`);
    }
  }

  async startConversation({
    sender,
    receiver,
  }: {
    sender: string;
    receiver: string;
  }): Promise<ConversationInstance> {
    try {
      const conversation =
        await this.twilioClient.conversations.v1.conversations.create({
          timers: { inactive: "PT10M", closed: "PT36000S" },
          state: "active",
          friendlyName: `${sender}-${receiver}-${new Date().getDate()}`,
        });
      return conversation;
    } catch (e) {
      this.logger_.error(
        `unable to create conversation between ${sender} & ${receiver} ${e.message}`
      );
    }
  }

  async getExistingConversation(convId: string): Promise<ConversationInstance> {
    try {
      return await this.twilioClient.conversations.v1
        .conversations(convId)
        .fetch();
    } catch (e) {
      this.logger_.error(
        `unable to fetech conversation with id ${convId} ${e.message}`
      );
    }
  }

  async joinAgent(
    convId: string,
    agentRealNumber: string
  ): Promise<ParticipantInstance> {
    const messageBinding = {
      address: `whatsapp:${agentRealNumber}`,
      proxyAddress: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    };
    const participants = await this.twilioClient.conversations.v1
      .conversations(convId)
      .participants.list();
    const agent = participants.find(
      (p) =>
        p.messagingBinding.address == messageBinding.address &&
        p.messagingBinding.proxy_address == messageBinding.proxyAddress
    );
    if (agent) {
      return agent;
    }
    try {
      const agent = await this.twilioClient.conversations.v1
        .conversations(convId)
        .participants.create({
          messagingBinding: messageBinding,
        });
      return agent;
    } catch (e) {
      this.logger_.error(
        `unable to add agent to conversation with id ${convId} ${e.message}`
      );
    }
  }
  async joinUser({
    convId,
    phone,
  }: {
    convId: string;
    phone: string;
  }): Promise<ParticipantInstance> {
    const messageBinding = {
      address: `whatsapp:${phone}`,
      proxyAddress: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    };
    const participants = await this.twilioClient.conversations.v1
      .conversations(convId)
      .participants.list();
    const user = participants.find(
      (p) =>
        p.messagingBinding.address == messageBinding.address &&
        p.messagingBinding.proxy_address == messageBinding.proxyAddress
    );
    if (user) {
      return user;
    }
    try {
      const user = await this.twilioClient.conversations.v1
        .conversations(convId)
        .participants.create({
          messagingBinding: messageBinding,
        });
      return user;
    } catch (e) {
      this.logger_.error(
        `unable to add user to conversation with id ${convId} ${e.message}`
      );
    }
  }

  async sendConversationMessageFromAgent(
    convId: string,
    message: string,
    agentNumber: string
  ): Promise<ConversationMessageInstance> {
    // Download the helper library from https://www.twilio.com/docs/node/install
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    try {
      const messageInstance = await this.twilioClient.conversations.v1
        .conversations(convId)
        .messages.create({
          author: `whatsapp:${agentNumber}`,
          body: message,
        });
      return messageInstance;
    } catch (e) {
      this.logger_.error(
        `unable to send message to conversation with id ${convId} ${e.message}`
      );
    }
  }

  async sendConversationContentTemplateFromAgent({
    convId,
    contentSid,
    contentVariables,
    agentNumber,
  }: {
    convId: string;
    contentSid: string;
    contentVariables: Record<string, string>;
    agentNumber: string;
  }): Promise<ConversationMessageInstance> {
    try {
      const messageInstance = await this.twilioClient.conversations.v1
        .conversations(convId)
        .messages.create({
          author: `whatsapp:${agentNumber}`,
          contentSid,
          contentVariables: JSON.stringify(contentVariables),
        });
      return messageInstance;
    } catch (e) {
      this.logger_.error(
        `unable to send message to conversation with id ${convId} ${e.message}`
      );
    }
  }
  async startWhatsappAgentConversation(
    sender: string,
    receiver: string,
    agentRealNumber?: string,
    otherPartyRealNumber?: string
  ): Promise<ConversationInstance> {
    try {
      try {
        const conversation = await this.findActiveConversationBetween2parties({
          agentRealNumber,
          otherParty: otherPartyRealNumber,
        });
        if (conversation) {
          return;
        }
      } catch (e) {
        this.logger_.error(`existing converation not found ${e.message}`);
      }
      const conversation = await this.startConversation({
        sender: `${sender}`,
        receiver: `${receiver}`,
      });
      await this.joinAgent(conversation.sid, sender);
      await this.joinUser({
        convId: conversation.sid,
        phone: receiver,
      });
      return conversation;
    } catch (e) {
      this.logger_, error("Unable to start agent conversation " + e.message);
    }
  }

  async getContentTemplate(contentId: string): Promise<ContentInstance> {
    try {
      const template = await this.twilioClient.content.v1
        .contents(contentId)
        .fetch();
      return template;
    } catch (e) {
      this.logger_.error("unable to fetch template with id:" + contentId);
    }
  }

  async findActiveConversationBetween2parties({
    agentRealNumber,
    otherParty,
  }: {
    agentRealNumber: string;
    otherParty: string;
  }) {
    const messageBindingAgent = {
      address: `whatsapp:${agentRealNumber}`,
      proxyAddress: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    };

    const messageBindingOtherParty = {
      address: `whatsapp:${otherParty}`,
      proxyAddress: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    };

    try {
      const results =
        await this.twilioClient.conversations.v1.conversations.list({});

      const findUser = (messageBinding, participants) =>
        participants.find(
          (p) =>
            p.messagingBinding.address == messageBinding.address &&
            p.messagingBinding.proxy_address == messageBinding.proxyAddress
        );

      for (const result of results) {
        const conversationParticipants = await result.participants().list();
        const firstuser = findUser(
          messageBindingAgent,
          conversationParticipants
        );
        const seconduser = findUser(
          messageBindingOtherParty,
          conversationParticipants
        );
        if (firstuser && seconduser && result.state == "active") {
          return result;
        }
      }
    } catch (e) {
      this.logger_.error(`unable to find conversation ${e.message}`);
    }
  }
}

export default WhatsappService;
