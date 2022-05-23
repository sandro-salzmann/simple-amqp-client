import { Channel, Options } from 'amqplib';
import Debug from 'debug';
const debug = Debug('simple-amqp-client:pub-sub');

type SubscribeOptions<Msg> = {
  serviceName: string;
  channel: Channel;
  routingKey: string;
  onMessage: (msg: Msg, routingKey: string) => Promise<void>;
  exchange?: string;
  exchangeOptions?: Options.AssertExchange;
  queueOptions?: Options.AssertQueue;
  consumeOptions?: Options.Consume;
};

export const subscribe = async <Msg>({
  serviceName,
  channel,
  routingKey,
  onMessage,
  exchange = 'default-exchange',
  exchangeOptions,
  queueOptions,
  consumeOptions,
}: SubscribeOptions<Msg>) => {
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
  // bind routingKey to the queue
  await channel.bindQueue(queue, exchange, routingKey);
  // bind queue itself as a key to the queue to receive delayed messages
  await channel.bindQueue(queue, exchange, queue);
  const delayQueue = `${queue}-delayed`;
  await channel.assertQueue(delayQueue, {
    durable: true,
    autoDelete: false,
    messageTtl: 3000,
    deadLetterExchange: exchange,
    // reroute to the queue of only this service (and not to all services using routingKey)
    deadLetterRoutingKey: queue,
  });

  await channel.consume(
    queue,
    async (msg) => {
      if (msg) {
        const msgRoutingKey = msg.fields.routingKey;
        const msgString = msg.content.toString();
        const msgLogMsg = `[${logMsg}, msgRoutingKey: ${msgRoutingKey}, msgString: ${msgString}]`;
        debug(`Start processing received message... ${msgLogMsg}`);
        const msgContent = JSON.parse(msgString) as Msg;
        try {
          await onMessage(msgContent, msgRoutingKey);
          debug(`Processed message. ${msgLogMsg}`);
          // acknowledge message to make sure it gets processed by another
          // instance of this service in case this instance fails
          channel.ack(msg);
        } catch (error: any) {
          debug(`Message processing failed. ${msgLogMsg}`, error);
          if (error?.invalidMsgFormat) {
            // don't redeliver a malformatted message
            channel.reject(msg, false);
            debug(
              `Rejected message because it has an invalid format. ${msgLogMsg}`,
            );
          } else {
            debug(`Sending message to delay-queue... ${msgLogMsg}`);
            // reject and send message to delay queue
            channel.reject(msg, false);
            channel.sendToQueue(delayQueue, Buffer.from(msgString), {
              persistent: true,
            });
            debug(`Sent message to delay-queue. ${msgLogMsg}`);
          }
        }
      }
    },
    consumeOptions,
  );
  debug(`Subscribed. [${logMsg}]`);
};
