import { sleep } from '../fixtures/sleep';
import { useBus } from '../fixtures/use-bus';

const { connectBus } = useBus();

type Foo = { text: string };

it('should store messages on bus if a service is unavailable', async () => {
  const subscriber1 = await connectBus();
  const publisher = await connectBus();

  // subscribe to make queue known to bus
  await subscriber1.subscribe<Foo>('test.*', async () => undefined);
  // close subscriber
  subscriber1.close();

  // publish messages
  await publisher.publish<Foo>('test.info', { text: 'Hello world!' });
  await publisher.publish<Foo>('test.info', { text: 'Hello world!' });
  // simulate downtime of service
  await sleep(5000);

  // start another subscriber
  let receivedCount = 0;
  const subscriber2 = await connectBus();
  await subscriber2.subscribe<Foo>('test.*', async () => {
    receivedCount += 1;
  });

  // let bus communicate
  await sleep();

  // subscriber should have received 2 messages that should have been stored
  // in the queue because they were sent during the service's downtime
  expect(receivedCount).toBe(2);
});
