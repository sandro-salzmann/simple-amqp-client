import { Channel, Options } from 'amqplib';
import Debug from 'debug';
const debug = Debug('simple-amqp-client:rpc');

type AnswerOptions = {
  channel: Channel;
  queue: string;
  onMessage: (msg: string) => Promise<string>;
  consumeOptions?: Options.Consume;
  queueOptions?: Options.AssertQueue;
}

export const answer = async ({
  channel,
  queue,
  onMessage,
  consumeOptions,
  queueOptions,
}: AnswerOptions) => {
  const logMsg = `queue: ${queue}`;
  debug(`Trying to start answering messages... [${logMsg}]`);
  await channel.assertQueue(queue, {
    durable: false,
    ...queueOptions,
  });
  await channel.consume(
    queue,
    async (msg) => {
      if (msg) {
        const msgContent = msg.content.toString();
        const msgLogMsg = `[${logMsg}, msgContent: ${msgContent}]`;
        debug(`Received call. ${msgLogMsg}`);

        debug(`Start processing call... ${msgLogMsg}`);
        const responseMsg = await onMessage(msgContent);
        debug(`Processed call. ${msgLogMsg}`);

        debug(`Trying to reply to call... ${msgLogMsg}`);
        const { replyTo, correlationId } = msg.properties;
        channel.sendToQueue(replyTo, Buffer.from(responseMsg), {
          correlationId,
        });
        debug(`Replied to call. ${msgLogMsg}`);
      }
    },
    {
      noAck: true,
      ...consumeOptions,
    },
  );
  debug(`Started answering messages. [queue: ${queue}]`);
};
