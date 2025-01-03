import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WhatsappService } from "../whatsapp";
import { MockManager } from "medusa-test-utils";
import mockedEventBusService from "../__mocks__/event-bus";
import { MedusaContainer } from "@medusajs/medusa/dist/types/global";
import dotenv from "dotenv";
import { Twilio } from "twilio";
import { orderServiceMock, cartServiceMock } from "../__mocks__/service.mocks";

const config = dotenv.config();

const TWILIO_ACCOUNT_SID =
  config.parsed?.TWILIO_AUTH_SID ||
  "ACDummy"; /* user production keys when testing with sandbox */
const TWILIO_ACCOUNT_TOKEN = config.parsed?.TWILIO_AUTH_TOKEN ?? "dummy";
const TWILIO_SAMPLE_WHATSAPP_CONTENT_SID =
  config.parsed?.TWILIO_SAMPLE_WHATSAPP_CONTENT_SID ?? "dummy";

const TEST_TWILIO_SANDBOX_NUMBER =
  config.parsed?.TEST_SEND_NUMBER ??
  "00000"; /* the number you created the sandbox with */
const TEST_RECEIVER_NUMBER = config.parsed?.TEST_RECEIVER_NUMBER;
const TEST_MESSAGE = "Your verification code is 11234";
const testOptions = {
  account_sid: TWILIO_ACCOUNT_SID,
  auth_token: TWILIO_ACCOUNT_TOKEN,
  medusaServerHost: "localhost",
  medusaServerPort: "9000",
  medusaServerProtocol: "http",
  whatsappHandlerInterface: jest.fn().mockReturnValue({
    whatsappHandlerInterface: async (scope: MedusaContainer, body: unknown) => {
      console.log("message received");
    },
  }),
} as any;

describe("WhatsappService", () => {
  describe("Sending Message", () => {
    let myWhatsappService: WhatsappService;
    beforeEach(() => {
      myWhatsappService = new WhatsappService(
        {
          logger: console as any,
          eventBusService: mockedEventBusService as any,
          manager: MockManager as any,
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
      jest
        .spyOn(myWhatsappService.twilioClient.messages, "create")
        .mockImplementation(
          (): Promise<any> =>
            Promise.resolve({
              body: "message",
            })
        );
    });

    it("initiate-sandbox", async () => {
      const sender = TEST_TWILIO_SANDBOX_NUMBER;
      const receiver = TEST_RECEIVER_NUMBER; /* sandbox member number */
      const message = TEST_MESSAGE;
      const result = await myWhatsappService.sendTextMessage({
        sender: sender,
        receiver: receiver,
        message: message,
        otherOptions: undefined,
        error: (error, done) => {
          if (error) {
            console.log(error);
          } else {
            return done;
          }
        },
      });
      expect(result).toBeDefined();
    });
    it("initiate-sandbox-qr", async () => {
      console.log("Testing qr");
      const sender = TEST_TWILIO_SANDBOX_NUMBER;
      const receiver = TEST_RECEIVER_NUMBER; /* sandbox member number */
      const message = JSON.stringify({
        contentSid: TWILIO_SAMPLE_WHATSAPP_CONTENT_SID,
        contentVariables: JSON.stringify({
          1: "test",
          2: "01-01-2024",
          3: "1234/1223",
        }),
      });

      const result = await myWhatsappService.sendTextMessage({
        sender,
        receiver,
        message,
        otherOptions: undefined,
        error: (error, done) => {
          if (error) {
            console.log(error);
          } else {
            console.log("Testing qr --done");

            return done;
          }
        },
      });
      expect(result).toBeDefined();
    });
  });
});
