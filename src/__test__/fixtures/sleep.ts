export const sleep = async (ms: number = 500) =>
  await new Promise((resume) => setTimeout(resume, ms));
