import { Channel, Options } from 'amqplib';
import Debug from 'debug';
const debug = Debug('simple-amqp-client:rpc');

type AnswerOptions<Msg> = {
  channel: Channel;
  queue: string;
  onMessage: (msg: Msg) => Promise<string>;
  consumeOptions?: Options.Consume;
  queueOptions?: Options.AssertQueue;
};

export const answer = async <Msg> ({
  channel,
  queue,
  onMessage,
  consumeOptions,
  queueOptions,
}: AnswerOptions<Msg>) => {
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
        const msgString = msg.content.toString();
        const msgContent = JSON.parse(msgString) as Msg;
        const msgLogMsg = `[${logMsg}, msgString: ${msgString}]`;
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
