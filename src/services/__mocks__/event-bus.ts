import { jest } from "@jest/globals";
export const EventBusServiceMock = {
  emit: jest.fn(),
  subscribe: jest.fn(),
  withTransaction: function (): any {
    return this;
  },
};

const mock = jest.fn().mockImplementation(() => {
  return EventBusServiceMock;
});

export default mock;
