import { useBus } from './fixtures/use-bus';

type Foo = { text: string };
type Bar = { upperCaseText: string };

const { connectBus } = useBus();

it('should work with one caller and one answerer', async () => {
  const answerer = await connectBus();
  const caller = await connectBus();

  await answerer.answer<Foo, Bar>('doUpperCasing', async (msg) => ({
    upperCaseText: msg.text.toUpperCase(),
  }));
  const response = await caller.call<Foo, Bar>('doUpperCasing', {
    text: 'hello world',
  });

  expect(response.upperCaseText).toBe('HELLO WORLD');
});

it('should be answerered by exactly one answerer', async () => {
  const answerer1 = await connectBus();
  const answerer2 = await connectBus();
  const caller = await connectBus();
  let answerCount = 0;

  await answerer1.answer<Foo, Bar>('doUpperCasing', async (msg) => {
    answerCount += 1;
    return { upperCaseText: '' };
  });
  await answerer2.answer<Foo, Bar>('doUpperCasing', async (msg) => {
    answerCount += 1;
    return { upperCaseText: '' };
  });
  await caller.call<Foo, Bar>('doUpperCasing', { text: '' });

  expect(answerCount).toBe(1);
});
