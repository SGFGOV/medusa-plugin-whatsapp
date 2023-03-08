import express, { Application } from "express";

export function mockServer(): unknown {
  const app = express();
  app.use(express.text(), express.json());

  return app;
}
