import amqp, { Channel, Options } from 'amqplib';
import Debug from 'debug';
import { EventEmitter } from 'events';
import { publish, subscribe } from './pub-sub';
import { answer, call } from './rpc';
const debug = Debug('simple-amqp-client:bus');

const DEFAULT_EXCHANGE_NAME = 'default-exchange';

export type PublishOptions = {
  exchange: string;
  publishOptions?: Options.Publish;
  queueOptions?: Options.AssertQueue;
};

export type SubscribeOptions = {
  exchange: string;
  consumeOptions?: Options.Consume;
  queueOptions?: Options.AssertQueue;
  exchangeOptions?: Options.AssertExchange;
};

export type CallOptions = {
  publishOptions?: Options.Publish;
  queueOptions?: Options.AssertQueue;
};

export type AnswerOptions = {
  consumeOptions?: Options.Consume;
  queueOptions?: Options.AssertQueue;
};

export class Bus {
  /**
   * The connected channel.
   */
  private channel?: Channel;
  /**
   * The amqp url.
   */
  private url: string | Options.Connect;
  /**
   * The event emitter that fires events with a message's correlationId when they are received by the channels direct reply-to pseudo-queue.
   */
  private replyQueueEventEmitter: EventEmitter;
  /**
   * The key which groups together instances of services. When using the pub-sub pattern only one instance of a service will receive the published message.
   */
  private serviceName: string;

  /**
   * Creates a new bus client. You can call {@link connect} explicitly or call any other method and the connection will be established implicitly.
   *
   * @param url The url of the bus
   * @param serviceName The name which groups together instances of services. When using the pub-sub pattern only one instance of a service will receive the published message.
   */
  constructor(url: string | Options.Connect, serviceName: string) {
    this.url = url;
    this.replyQueueEventEmitter = new EventEmitter();
    this.serviceName = serviceName;
  }

  /**
   * Creates a connection with the bus using the {@link url} supplied during initialization.
   */
  async connect() {
    debug('Trying to connect to bus...');
    const connection = await amqp.connect(this.url);
    const channel = await connection.createChannel();
    debug('Successfully connected to bus.');
    this.channel = channel;
    debug('Trying to consume the direct reply-to pseudo-queue...');
    await channel.consume(
      'amq.rabbitmq.reply-to',
      (msg) => {
        if (msg) {
          const msgContent = msg.content.toString();
          const { correlationId } = msg.properties;
          this.replyQueueEventEmitter.emit(correlationId, msgContent);
        }
      },
      { noAck: true },
    );
    debug('Started consuming the direct reply-to pseudo-queue.');
  }

  /**
   * Gets the current connected channel. If there is none it calls {@link connect} to create a channel.
   *
   * @throws {@link Error}
   * This exception is thrown if the channel isn't ready after {@link connect} has been called.
   *
   * @returns The connected channel
   */
  async getConnectedChannel() {
    if (!this.channel) await this.connect();
    if (!this.channel) throw new Error('Channel could not be established.');
    return this.channel;
  }

  /**
   * Publishes a message with a routing key.
   *
   * The default options guarantee that all published messages will be stored on the bus until one instance of each service has processed the message.
   *
   * @param routingKey The amqp routing key used for the message
   * @param msg The message itself
   * @param options The options used for sending the message
   */
  async publish(
    routingKey: string,
    msg: string,
    {
      exchange = DEFAULT_EXCHANGE_NAME,
      publishOptions,
      queueOptions,
    }: PublishOptions = { exchange: DEFAULT_EXCHANGE_NAME },
  ): Promise<void> {
    const channel = await this.getConnectedChannel();
    publish({
      channel,
      routingKey,
      msg,
      exchange,
      publishOptions,
      queueOptions,
    });
  }

  /**
   * Subscribes to a routing key and calls onMessage on every message.
   *
   * The default options guarantee that all published messages will be stored persistently on the bus until one instance of each service has processed the message.
   * All instances of the same running service should have the same {@link serviceName}, which is supplied during initialization.
   *
   * @param routingKey The amqp routing key used for the messages that should be received
   * @param onMessage The callback that gets called every time a new message is received by this instance
   * @param options The options used for receiving messages
   */
  async subscribe(
    routingKey: string,
    onMessage: (msg: string) => void,
    {
      exchange = DEFAULT_EXCHANGE_NAME,
      consumeOptions,
      queueOptions,
      exchangeOptions,
    }: SubscribeOptions = { exchange: DEFAULT_EXCHANGE_NAME },
  ): Promise<void> {
    const channel = await this.getConnectedChannel();
    await subscribe({
      serviceName: this.serviceName,
      channel,
      routingKey,
      onMessage,
      exchange,
      consumeOptions,
      queueOptions,
      exchangeOptions,
    });
  }

  /**
   * Sends remote procedure calls and returns the answer synchronously.
   *
   * The default options don't persistently store the messages on the bus and don't guarantee that a service will receive, process or answer the call successfully.
   * Check if the call has been processed by checking the return value.
   *
   * @param queue The queue to write messages to
   * @param msg The message itself
   * @param options The options used for sending messages
   * @returns A promise of the response message
   */
  async call(
    queue: string,
    msg: string,
    { publishOptions, queueOptions }: CallOptions = {},
  ): Promise<string> {
    const channel = await this.getConnectedChannel();
    return call({
      channel,
      replyQueueEventEmitter: this.replyQueueEventEmitter,
      queue,
      msg,
      publishOptions,
      queueOptions,
    });
  }

  /**
   * Receives and responds to remote procedure calls.
   *
   * The default options don't persistently store the messages on the bus and don't guarantee that a service will receive, process or answer the call successfully.
   * Meaning, if a message is received twice, the client must have sent the message twice using {@link call}.
   *
   * @param queue The queue to read messages from
   * @param onMessage The callback that gets called every time a new message is received
   * @param options The options used for receiving messages
   */
  async answer(
    queue: string,
    onMessage: (msg: string) => Promise<string>,
    { consumeOptions, queueOptions }: AnswerOptions = {},
  ): Promise<void> {
    const channel = await this.getConnectedChannel();
    await answer({ channel, queue, onMessage, consumeOptions, queueOptions });
  }
}
