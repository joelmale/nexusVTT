import { env } from '../config/env';

export type GroundedAnswerInput = {
  question: string;
  snippets: string[];
};

export const buildGroundedPrompt = (input: GroundedAnswerInput) => {
  const citations = input.snippets.map((snippet, index) => `Source ${index + 1}:\n${snippet}`).join('\n\n');
  return [
    'You are a rules assistant. Use only the provided sources.',
    'If the sources are insufficient, respond with "Insufficient sources to answer."',
    '',
    `Question: ${input.question}`,
    '',
    citations,
    '',
    'Answer with a concise summary and cite sources in brackets like [1], [2].',
  ].join('\n');
};

export const generateGroundedAnswer = async (_input: GroundedAnswerInput) => {
  if (env.LLM_PROVIDER === 'none') {
    return null;
  }
  return null;
};
