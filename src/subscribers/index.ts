import { EntityManager } from "typeorm";
import { EventBusService } from "@medusajs/medusa/dist/services";

class MySubscriber {
  #manager: EntityManager;

  constructor({
    manager,
    eventBusService,
  }: {
    manager: EntityManager;
    eventBusService: EventBusService;
  }) {
    this.#manager = manager;
  }

  public async handleOrderPlaced({ id }: { id: string }): Promise<unknown> {
    return true;
  }
}

export default MySubscriber;
