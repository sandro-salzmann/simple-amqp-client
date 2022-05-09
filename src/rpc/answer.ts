import { Channel, Options } from 'amqplib';
import Debug from 'debug';
const debug = Debug('simple-amqp-client:rpc');

type AnswerOptions<ReqMsg, ResMsg> = {
  channel: Channel;
  queue: string;
  onMessage: (msg: ReqMsg) => Promise<ResMsg>;
  consumeOptions?: Options.Consume;
  queueOptions?: Options.AssertQueue;
};

export const answer = async <ReqMsg, ResMsg>({
  channel,
  queue,
  onMessage,
  consumeOptions,
  queueOptions,
}: AnswerOptions<ReqMsg, ResMsg>) => {
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
        const msgLogMsg = `[${logMsg}, msgString: ${msgString}]`;
        debug(`Received call. ${msgLogMsg}`);
        const msgContent = JSON.parse(msgString) as ReqMsg;

        debug(`Start processing call... ${msgLogMsg}`);
        const responseMsg = (await onMessage(msgContent)) as ResMsg;
        debug(`Processed call. ${msgLogMsg}`);

        debug(`Trying to reply to call... ${msgLogMsg}`);
        const { replyTo, correlationId } = msg.properties;
        channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(responseMsg)), {
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
