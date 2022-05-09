import { Channel, Options } from 'amqplib';
import Debug from 'debug';
const debug = Debug('simple-amqp-client:pub-sub');

type SubscribeOptions = {
  serviceName: string;
  channel: Channel;
  routingKey: string;
  onMessage: (msg: string, routingKey: string) => void;
  exchange?: string;
  exchangeOptions?: Options.AssertExchange;
  queueOptions?: Options.AssertQueue;
  consumeOptions?: Options.Consume;
};

export const subscribe = async ({
  serviceName,
  channel,
  routingKey,
  onMessage,
  exchange = 'default-exchange',
  exchangeOptions,
  queueOptions,
  consumeOptions,
}: SubscribeOptions) => {
  const logMsg = `exchange: ${exchange}, routingKey: ${routingKey}`;
  debug(`Trying to subscribe... [${logMsg}]`);
  await channel.assertExchange(exchange, 'topic', {
    durable: true,
    ...exchangeOptions,
  });
  // the queue name consists of the name of the service and the routingKey to
  // make all instances of a service use the same queue
  const queue = `${serviceName}-${routingKey}`;
  await channel.assertQueue(queue, {
    durable: true,
    ...queueOptions,
  });
  channel.bindQueue(queue, exchange, routingKey);
  channel.consume(
    queue,
    (msg) => {
      if (msg) {
        const msgRoutingKey = msg.fields.routingKey;
        const msgString = msg.content.toString();
        const msgLogMsg = `msgRoutingKey: ${msgRoutingKey}, msgString: ${msgString}`;
        debug(`Start processing received message... [${logMsg}, ${msgLogMsg}]`);
        onMessage(msgContent, msgRoutingKey);
        debug(`Processed message. [${logMsg}, ${msgLogMsg}]`);
        // acknowledge message to make sure it gets processed by another
        // instance of this service in case this instance fails
        channel.ack(msg);
      }
    },
    consumeOptions,
  );
  debug(`Subscribed. [${logMsg}]`);
};
