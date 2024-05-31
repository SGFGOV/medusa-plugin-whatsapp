import {
  type ScheduledJobConfig,
  type ScheduledJobArgs,
  Logger,
} from "@medusajs/medusa";
import { WhatsappService } from "../services/whatsapp";
import { UserConversationInstance } from "twilio/lib/rest/conversations/v1/user/userConversation";

export default async function handler({
  container,
  data,
}: ScheduledJobArgs): Promise<void> {
  const whatsappService = container.resolve(
    "whatsappService"
  ) as WhatsappService;
  const logger = container.resolve("logger") as Logger;
  try {
    const users = await whatsappService.twilioClient.conversations.users.list();
    await Promise.all(
      users.map(async (user) => {
        const conversations = user.userConversations();
        try {
          const userConversationInstances = await conversations.list();
          let lastUserConversationInstance: UserConversationInstance;
          for (const conversation of userConversationInstances) {
            if (!lastUserConversationInstance) {
              lastUserConversationInstance = conversation;
            } else {
              const today = new Date();
              const dateToCheck =
                conversation.dateUpdated || conversation.dateCreated;
              const differenceInDays = Math.floor(
                (today.getTime() - dateToCheck.getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              if (differenceInDays > 7) {
                try {
                  await conversation.remove();
                } catch (e) {
                  logger.error(
                    ` unable to remove converstation of ${user.identity} ${conversation.conversationSid} ${e.message}`
                  );
                }
              }
            }
          }
        } catch (e) {
          logger.error(
            ` unable to fetch conversations of user ${user.identity} ${e.message}`
          );
        }
        try {
          const userConversationInstances = await conversations.list();
          try {
            if (userConversationInstances?.length == 0) {
              if (user.identity != (data as { agent: string }).agent) {
                await user.remove();
              }
            }
          } catch (e) {
            logger.error(` unable to remve user ${user.identity}`);
          }
        } catch (e) {
          logger.error(
            ` unable to fetch conversations of user ${user.identity} ${e.message}`
          );
          try {
            if (user.identity != (data as { agent: string }).agent) {
              await user.remove();
            }
          } catch (e) {
            logger.error(` unable to remve user ${user.identity}`);
          }
        }
      })
    );
  } catch (e) {
    logger.error(`error cleaning up users ${e.message}`);
  }
}
export const config: ScheduledJobConfig = {
  name: "cleanup-conversations",
  schedule: "0 0 * * *",
  data: {
    agent: process.env.TWILIO_WHATSAPP_AGENT_NAME || "AGENT",
  },
};
