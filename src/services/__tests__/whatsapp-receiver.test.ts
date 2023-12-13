import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import twilio from "twilio";
import {
  WhatsappService,
  WhatsappHandlerInterface,
} from "../whatsapp-interface";
import { MockManager } from "medusa-test-utils";
import mockedEventBusService from "../__mocks__/event-bus";
import { MedusaContainer } from "@medusajs/medusa/dist/types/global";
import dotenv from "dotenv";
import {
  cartServiceMock,
  mockServer,
  orderServiceMock,
} from "../__mocks__/service.mocks";
import { asFunction, createContainer } from "awilix";
import whatsAppRoutes from "../../api";
import getSignature from "../../utils/generate-signature";
import supertest from "supertest";
import { Router } from "express";

const config = dotenv.config();

const TWILIO_ACCOUNT_SID =
  config.parsed?.TWILIO_AUTH_SID ||
  "ACDummy"; /* user production keys when testing with sandbox */
const TWILIO_ACCOUNT_TOKEN = config.parsed?.TWILIO_AUTH_TOKEN ?? "bla-bla-bla";
const TEST_TWILIO_SANDBOX_NUMBER =
  config.parsed?.TEST_SEND_NUMBER ??
  "00000"; /* the number you created the sandbox with */
const TEST_RECEIVER_NUMBER = config.parsed?.TEST_RECEIVER_NUMBER;
const TEST_MESSAGE = "Your verification code is 11234";
const whatsappHandlerInterface = jest.fn().mockReturnValue({
  whatsappHandler: async (scope: MedusaContainer, body: unknown) => {
    console.log("message received");
    expect(true).toBe(true);
    return "test";
  },
});
const testOptions = {
  account_sid: TWILIO_ACCOUNT_SID,
  auth_token: TWILIO_ACCOUNT_TOKEN,
  medusaServerHost: "localhost",
  medusaServerPort: "9000",
  medusaServerProtocol: "http",
  whatsappHandlerInterface: "whatsappHandlerInterface",
} as any;

describe("WhatsappService", () => {
  let myWhatsappService: WhatsappService;
  /* describe("Sending Message", () => {
    
    beforeEach(() => {
       /*jest.spyOn(twilio, "TwilioSDK").mockImplementation((a, b, c): any => {return{
        {
          messages{create: (): any => Promise.resolve({ body: "test-body" })},
        } }}
      );
      myWhatsappService = new WhatsappInterfaceService(
        {
          logger: console as any,
          eventBusService: mockedEventBusService as any,
          manager: MockManager,
        },
        testOptions
      );
    });

    it("initiate-sandbox", async () => {
      const sender = TEST_TWILIO_SANDBOX_NUMBER;
      const reciever = TEST_RECEIVER_NUMBER; /* sandbox member number 
      const message = TEST_MESSAGE;
      const result = await myWhatsappService.sendTextMessage(
        sender,
        reciever,
        message,
        undefined,
        (error, done) => {
          if (error) {
            console.log(error);
          } else {
            return done;
          }
        }
      );
      expect(result).toBeDefined();
    });
  });*/
  describe("Recieving  Message", () => {
    let myWhatsappService: WhatsappService;
    let app;
    beforeAll(() => {
      myWhatsappService = new WhatsappService(
        {
          logger: console as any,
          eventBusService: mockedEventBusService() as any,
          manager: MockManager,
          orderService: orderServiceMock as any,
          cartService: cartServiceMock as any,
          storeService: undefined,
          returnService: undefined,
          giftCardService: undefined,
          swapService: undefined,
          lineItemService: undefined,
          fulfillmentProviderService: undefined,
          fulfillmentService: undefined,
          claimService: undefined,
          totalsService: undefined,
          productVariantService: undefined,
        },
        testOptions
      );
      app = mockServer() as Router;
      const container = createContainer();
      container.register("manager", asFunction(() => MockManager).singleton());
      container.register(
        "eventBusService",
        asFunction(() => mockedEventBusService()).singleton()
      );
      container.register(
        "whatsappInterfaceService",
        asFunction(() => myWhatsappService).singleton()
      );
      container.register(
        "whatsappHandlerInterface",
        asFunction(() => whatsappHandlerInterface()).singleton()
      );
      app.use((req, _res, next) => {
        req["scope"] = container.createScope() as any;
        next();
      });

      app.use("/", whatsAppRoutes("", testOptions, {}));
      app._router.stack.forEach(function (r) {
        if (r.route && r.route.path) {
          console.log(r.route.path);
        }
      });
    });

    it("check security header verifier", async () => {
      // Your Auth Token from twilio.com/console
      const authToken = "bla-bla-bla";
      /** taken from https://www.twilio.com/docs/usage/webhooks/webhooks-security */
      // The Twilio request URL
      const url = "https://mycompany.com/myapp.php?foo=1&bar=2";

      // The post variables in Twilio's request
      const params = {
        CallSid: "CA1234567890ABCDE",
        Caller: "+12349013030",
        Digits: "1234",
        From: "+12349013030",
        To: "+18005551212",
      };

      // The X-Twilio-Signature header attached to the request
      const signature = await getSignature(authToken, url, params);
      const twilioSignature =
        "WhE/AXscNWfXaM/e78WXqBlygRY="; /** when token is bla-bla-bla */

      expect(signature).toBe(twilioSignature);
      expect(
        twilio.validateRequest(authToken, twilioSignature, url, params)
      ).toBeTruthy();
    });

    it("Sanity Check Api", async () => {
      const result = await supertest(app).post("/").set("Accept", "text/xml");
      expect(result.status).toBe(404);
    });

    it("post  any /whatsapp-message", async () => {
      const params = {
        SmsMessageSid: "SM91234567890123456789012345678901",
        NumMedia: "0",
        ProfileName: "Test Profile",
        SmsSid: "SM91234567890123456789012345678901",
        WaId: "1234567899",
        SmsStatus: "received",
        Body: "hi",
        To: "whatsapp:+123456789",
        NumSegments: "1",
        ReferralNumMedia: "0",
        MessageSid: "SM91234567890123456789012345678901",
        AccountSid: TWILIO_ACCOUNT_SID,
        From: "whatsapp:+1234567899",
        ApiVersion: "2010-04-01",
      };
      const url =
        `${testOptions.medusaServerProtocol}://` +
        `${testOptions.medusaServerHost}:` +
        `${testOptions.medusaServerPort}/whatsapp/received`;
      const signature = await getSignature(TWILIO_ACCOUNT_TOKEN, url, params);
      const result = await supertest(app)
        .post("/whatsapp/received")
        .type("form")
        .set("accept", "text")
        .set("x-twilio-signature", signature)
        .send(params);
      // .expect(200);
      expect(result.status).toBe(200);
      expect(result?.body).toBeDefined();
      expect(result?.body.error).toBeUndefined();
      // Check the response type and length
      // Check the response data
    }, 60e3);
  });
});
