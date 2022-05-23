import { v4 as uuidv4 } from 'uuid';
import { sleep } from '../fixtures/sleep';
import { useBus } from '../fixtures/use-bus';

const { connectBus } = useBus();

type Foo = { text: string };

// unacknowledged messages get redelivered after 3s
const REDELIVERY_TIMEOUT = 3_000;

it('should redeliver unacknowledged messages after the redelivery timeout', async () => {
  const defectSubscriber = await connectBus();
  const workingSubscriber = await connectBus();
  const publisher = await connectBus();
  let receivedCount = 0;

  // subscriber that throws an error
  await defectSubscriber.subscribe<Foo>('test.*', async () => {
    throw new Error('to prevent acknowledge');
  });
  // correctly acknowledging subscriber
  await workingSubscriber.subscribe<Foo>('test.*', async () => {
    receivedCount += 1;
  });
  // publish message
  await publisher.publish<Foo>('test.info', { text: 'Hello world!' });

  // let bus communicate
  await sleep(500);
  // the working subscriber should not have gotten the message yet
  expect(receivedCount).toBe(0);
  // let messages get redelivered to the working subscriber
  await sleep(REDELIVERY_TIMEOUT);
  // the working subscriber should have gotten the message now
  expect(receivedCount).toBe(1);
});

it('should not redeliver invalid messages', async () => {
  const defectSubscriber = await connectBus();
  const workingSubscriber = await connectBus();
  const publisher = await connectBus();
  let receivedCount = 0;

  // subscriber that throws an invalidMsgFormat error
  await defectSubscriber.subscribe<Foo>('test.*', async () => {
    throw { invalidMsgFormat: true };
  });
  // correctly acknowledging subscriber
  await workingSubscriber.subscribe<Foo>('test.*', async () => {
    receivedCount += 1;
  });
  // publish message
  // @ts-ignore to test malformed messages with an invalid format
  await publisher.publish<Foo>('test.info', { notCorrectText: 5 });

  // let bus communicate
  await sleep(500);
  // the working subscriber should not get the message
  expect(receivedCount).toBe(0);
  // let messages get possibly redelivered to the working subscriber
  await sleep(REDELIVERY_TIMEOUT);
  // the working subscriber should still not get the message
  expect(receivedCount).toBe(0);
});

it('should redeliver messages only to the services that have not acknowledged the message and not to all services', async () => {
  const defectSubscriberA = await connectBus('service-a');
  const workingSubscriberA = await connectBus('service-a');
  const workingSubscriberB = await connectBus('service-b');
  const publisher = await connectBus();
  let receivedCountA = 0;
  let receivedCountB = 0;

  // subscriber that throws an error
  await defectSubscriberA.subscribe<Foo>(`test.*`, async () => {
    throw new Error('to prevent acknowledge');
  });
  // correctly acknowledging subscribers
  await workingSubscriberA.subscribe<Foo>(`test.*`, async () => {
    receivedCountA += 1;
  });
  await workingSubscriberB.subscribe<Foo>(`test.*`, async () => {
    receivedCountB += 1;
  });
  // publish message
  await publisher.publish<Foo>(`test.info`, {
    text: 'Hello world!',
  });

  // let bus communicate
  await sleep();
  // the working subscriber from service A should not get the message
  expect(receivedCountA).toBe(0);
  // the subscriber from service B should get the message
  expect(receivedCountB).toBe(1);
  // let messages get redelivered to the working subscriber
  await sleep(REDELIVERY_TIMEOUT);
  // the working subscriber from service A should get the message
  expect(receivedCountA).toBe(1);
  // the subscriber from service B should not get the message again
  expect(receivedCountB).toBe(1);
});

it('should store redelivered messages on bus if a service is unavailable', async () => {
  const subscriber1 = await connectBus();
  const subscriber2 = await connectBus();
  const publisher = await connectBus();
  let receivedCount = 0;

  // subscriber that makes the delay queue known to the bus and throws an error on messages
  await subscriber1.subscribe<Foo>('test.*', async () => {
    throw new Error('to prevent acknowledge');
  });
  // publish message
  await publisher.publish<Foo>('test.info', {
    text: 'Hello world!',
  });
  // let bus communicate
  await sleep();
  // simulate down-time of services to redeliver the messages to
  await subscriber1.close();
  await sleep(3 * REDELIVERY_TIMEOUT);
  // correctly acknowledging subscriber
  await subscriber2.subscribe<Foo>('test.*', async () => {
    receivedCount += 1;
  });

  // let bus communicate
  await sleep();
  // the working subscriber should have gotten the redelivered message now
  expect(receivedCount).toBe(1);
});
