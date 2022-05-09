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
// pub/sub
await bus.subscribe('test.*', async (msg, routingKey) => console.log(`New test message: ${msg.text}:${routingKey}`));
await bus.publish('test.info', { text: 'Hello world!' });
// logs 'New test message: Hello world!:test.info'

// rpc
await bus.answer('doUpperCasing', async (msg) => msg.text.toUpperCase());
const response = await bus.call('doUpperCasing', { text: 'hello world' });
console.log(response)
// logs 'HELLO WORLD'
```

## Docs

Check out the [documentation](https://sandro-salzmann.github.io/simple-amqp-client/).

## Debug

Logs are written with [debug](https://www.npmjs.com/package/debug).

```sh
DEBUG=simple-amqp-client:* npm run ...
```
