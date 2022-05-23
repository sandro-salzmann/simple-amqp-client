import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Bus } from '../../bus';

const RABBITMQ_DEFAULT_USER = 'user';
const RABBITMQ_DEFAULT_PASS = 'password';

export const useBus = () => {
  let container: GenericContainer;
  let startedContainer: StartedTestContainer;
  let connectedBusses: Bus[] = [];

  // increase timeout because of containers
  jest.setTimeout(60_000);

  beforeAll(async () => {
    container = new GenericContainer('rabbitmq:3')
      .withExposedPorts(5672)
      .withEnv('RABBITMQ_DEFAULT_USER', RABBITMQ_DEFAULT_USER)
      .withEnv('RABBITMQ_DEFAULT_PASS', RABBITMQ_DEFAULT_PASS);
    startedContainer = await container.start();
  });

  afterAll(async () => {
    await startedContainer.stop();
  });

  afterEach(async () => {
    // close all bus connections
    connectedBusses.forEach(async (bus) => {
      await bus.close();
    });
    connectedBusses = [];
  });

  const connectBus = async (serviceName = 'service-a') => {
    const RABBITMQ_HOST = startedContainer.getHost();
    const RABBITMQ_PORT = startedContainer.getMappedPort(5672);
    const bus = new Bus(
      `amqp://${RABBITMQ_DEFAULT_USER}:${RABBITMQ_DEFAULT_PASS}@${RABBITMQ_HOST}:${RABBITMQ_PORT}`,
      serviceName,
    );
    await bus.connect();
    connectedBusses.push(bus);
    return bus;
  };

  return { connectBus };
};
