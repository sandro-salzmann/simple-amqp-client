import { sleep } from '../fixtures/sleep';
import { useBus } from '../fixtures/use-bus';

type Foo = { text: string };

const { connectBus } = useBus();

it('should work with one subscriber and one publisher', async () => {
  const subscriber = await connectBus();
  const publisher = await connectBus();
  let receivedMsg: Foo | undefined = undefined;
  let receivedCount = 0;

  await subscriber.subscribe<Foo>('test.*', async (msg) => {
    receivedMsg = msg;
    receivedCount += 1;
  });
  await publisher.publish<Foo>('test.info', { text: 'Hello world!' });

  // let bus communicate
  await sleep();

  // message should be correct
  if (!receivedMsg) fail();
  expect(receivedMsg).toBeDefined();
  expect(receivedMsg).toHaveProperty('text');
  expect((receivedMsg as Foo).text).toBe('Hello world!');
  // subscriber should have been called exactly once
  expect(receivedCount).toBe(1);
});

it('should publish to exactly one instance of each subscribed service', async () => {
  const subscriberA1 = await connectBus('service-A');
  const subscriberA2 = await connectBus('service-A');
  const subscriberB1 = await connectBus('service-B');
  const publisher = await connectBus();
  let receivedCountA = 0;
  let receivedCountB = 0;

  await subscriberA1.subscribe<Foo>('test.*', async () => {
    receivedCountA += 1;
  });
  await subscriberA2.subscribe<Foo>('test.*', async () => {
    receivedCountA += 1;
  });
  await subscriberB1.subscribe<Foo>('test.*', async () => {
    receivedCountB += 1;
  });

  await publisher.publish<Foo>('test.info', { text: 'Hello world!' });

  // let bus communicate
  await sleep();

  // one subscriber of each service should have been called
  expect(receivedCountA).toBe(1);
  expect(receivedCountB).toBe(1);
});
