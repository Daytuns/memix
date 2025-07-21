#!/usr/bin/env node

import { config } from 'dotenv';
import simpleGit from 'simple-git';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fetch from 'node-fetch';

config();
const git = simpleGit();

async function getStagedDiff() {
  const diff = await git.diff(['--cached']);
  return diff.trim();
}

async function generateCommitMessage(diff) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
    model: 'mistral-saba-24b',
    messages: [
                {
          role: 'system',
          content: `You are a professional software engineer. Based on a git diff, write a specific, concise commit message that clearly describes what changed and why.
          Requirements:
          - Use present tense ("add feature", not "added").
          - Be specific: if the README was updated with setup instructions, say so.
          - Never say "update README" or "update file" — describe what the update is.
          - Do not reference "this diff", "the following", or file names unless essential.
          - Avoid vague verbs like "change", "modify", "update" unless followed by a specific reason.
          - No greetings, no colons, no markdown formatting, no explanations — only the commit message.

          Examples:
          - Add setup instructions for Groq API key in README
          - Clarify usage example in README.md
          - Improve install section to avoid confusion for Windows users
          - Fix typo in README instructions for .env setup
          - Add note on security tradeoffs in API key usage

          The goal is to write commit messages as if a human carefully summarized the purpose of the change.`
          },
        {
          role: 'user',
          content: `Git diff:\n${diff}`
        }
    ],
    temperature: 0.5,
    max_tokens: 128,
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Groq API error:', data);
    return null;
  }

  return data.choices?.[0]?.message?.content?.trim();
}


async function main() {
  const diff = await getStagedDiff();

  if (!diff) {
    console.log(chalk.red('No staged changes found.'));
    return;
  }

  const message = await generateCommitMessage(diff);

  if (!message) {
        console.log(chalk.red('Failed to generate commit message.'));
        return;
  }



  console.log(chalk.green('\nSuggested commit message:\n'));
  console.log(chalk.yellow(`"${message}"`));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Use this commit message?',
      default: true,
    },
  ]);

  if (confirm) {
    await git.commit(message);
    console.log(chalk.cyan('Commit created!'));
  } else {
    console.log(chalk.gray('Commit cancelled.'));
  }
}

main();
