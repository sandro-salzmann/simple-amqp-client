import { Channel, Options } from 'amqplib/callback_api';
import Debug from 'debug';
const debug = Debug('simple-amqp-client:pub-sub');

type PublishOptions = {
  channel: Channel;
  routingKey: string;
  msg: string;
  exchange?: string;
  queueOptions?: Options.AssertQueue;
  publishOptions?: Options.Publish;
};

export const publish = ({
  channel,
  exchange = 'default-exchange',
  routingKey,
  msg,
  queueOptions,
  publishOptions,
}: PublishOptions) => {
  const logMsg = `[exchange: ${exchange}, routingKey: ${routingKey}, msg: ${msg}]`;
  debug(`Trying to publish... ${logMsg}`);
  channel.assertExchange(exchange, 'topic', {
    durable: true,
    ...queueOptions,
  });
  channel.publish(exchange, routingKey, Buffer.from(msg), {
    persistent: true,
    ...publishOptions,
  });
  debug(`Published. ${logMsg}`);
};
