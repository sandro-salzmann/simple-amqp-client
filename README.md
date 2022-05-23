# simple-amqp-client

A simple amqp client that provides an interface on a messaging-pattern abstraction level.

Currently supported are pub/sub and rpc. 

## Installation

```sh
npm i simple-amqp-client
```

## Getting started

Import the Bus class and connect to your bus.
```ts
import { Bus } from 'simple-amqp-client';

...

const bus = new Bus(`amqp://user:password@localhost:5672`, "service-a");
await bus.connect();
```

Then start using messaging patterns as you wish! You can find the communication details in the [docs](https://sandro-salzmann.github.io/simple-amqp-client/classes/Bus.html#answer).

```ts
type Foo = { text: string }
type Bar = { upperCaseText: string }

// pub/sub
await bus.subscribe<Foo>(
    'test.*',
    async (msg, routingKey) => console.log(`New test message: ${msg.text}:${routingKey}`)
);
await bus.publish<Foo>(
    'test.info',
    { text: 'Hello world!' }
);
// logs 'New test message: Hello world!:test.info'

// rpc
await bus.answer<Foo, Bar>(
    'doUpperCasing',
    async (msg) => ({ upperCaseText: msg.text.toUpperCase() })
);
const response = await bus.call<Foo, Bar>(
    'doUpperCasing',
    { text: 'hello world' }
);
console.log(response.upperCaseText)
// logs 'HELLO WORLD'
```

### Error handling

**Publish/Subscribe pattern**

When a message couldn't be processed you might want to republish the message so it can be consumed by some instance of this service again.

```ts
await subscriber.subscribe<Foo>('test.*', async () => {
    throw new Error('Database currently not available.');
});
```

To do that just throw an error inside of the `onMessage` handler function. The message will be republished to the service after a delay of 3 seconds.

You can prevent republishing a message while still rejecting it by throwing `{ invalidMsgFormat: true }`.

```ts
await defectSubscriber.subscribe<Foo>('test.*', async () => {
    throw { invalidMsgFormat: true };
});
```

## Docs

Check out the [documentation](https://sandro-salzmann.github.io/simple-amqp-client/).

## Debug

Logs are written with [debug](https://www.npmjs.com/package/debug).

```sh
DEBUG=simple-amqp-client:* npm run ...
```
