import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WhatsappInterfaceService } from "../whatsapp-interface";
import { MockManager } from "medusa-test-utils";
import mockedEventBusService from "../__mocks__/event-bus";
import { MedusaContainer } from "@medusajs/medusa/dist/types/global";
import dotenv from "dotenv";

const config = dotenv.config();

const TWILIO_ACCOUNT_SID =
  config.parsed?.TWILIO_AUTH_SID ||
  "ACDummy"; /* user production keys when testing with sandbox */
const TWILIO_ACCOUNT_TOKEN = config.parsed?.TWILIO_AUTH_TOKEN ?? "dummy";
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
    let myWhatsappService: WhatsappInterfaceService;
    beforeEach(() => {
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
      const receiver = TEST_RECEIVER_NUMBER; /* sandbox member number */
      const message = TEST_MESSAGE;
      const result = await myWhatsappService.sendTextMessage(
        sender,
        receiver,
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
  });
});
