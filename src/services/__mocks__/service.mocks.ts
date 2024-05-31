import express, { Application } from "express";

export function mockServer(): unknown {
  const app = express();
  app.use(express.text(), express.json());

  return app;
}

export const orderServiceMock = {
  retrieve: jest.fn().mockImplementation((data) => {
    return Promise.resolve({
      email: "test@test.com",
      currency_code: "usd",
      items: [],
      discounts: [],
      gift_cards: [],
      created_at: new Date(),
    });
  }),
};

export const cartServiceMock = {
  retrieve: jest.fn().mockImplementation((data) => {
    return Promise.resolve({
      context: {
        locale: "de-DE",
      },
    });
  }),
};
