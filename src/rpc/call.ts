import { Channel, Options } from 'amqplib';
import Debug from 'debug';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
const debug = Debug('simple-amqp-client:rpc');

type CallOptions = {
  channel: Channel;
  replyQueueEventEmitter: EventEmitter;
  queue: string;
  msg: string;
  publishOptions?: Options.Publish;
  queueOptions?: Options.AssertQueue;
}

export const call = async ({
  channel,
  replyQueueEventEmitter,
  queue,
  msg,
  publishOptions,
  queueOptions,
}: CallOptions) =>
  new Promise<string>(async (resolve, reject) => {
    try {
      const logMsg = `queue: ${queue}, msg: ${msg}`;
      await channel.assertQueue(queue, {
        durable: false,
        ...queueOptions,
      });

      var correlationId = uuidv4();

      replyQueueEventEmitter.setMaxListeners(0);
      replyQueueEventEmitter.once(correlationId, (msgContent: string) => {
        debug(`Call got answered. [${logMsg}, answerMsg: ${msgContent}]`);
        resolve(msgContent);
      });

      debug(`Trying to call... [${logMsg}]`);
      await channel.sendToQueue(queue, Buffer.from(msg), {
        correlationId,
        replyTo: 'amq.rabbitmq.reply-to',
        ...publishOptions,
      });
      debug(`Called. [${logMsg}]`);
    } catch (error) {
      reject(error);
    }
  });
