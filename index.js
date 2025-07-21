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
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: 'You are a senior software engineer writing clean, conventional git commit messages.',
        },
        {
          role: 'user',
          content: `Write a concise git commit message based on this diff:\n${diff}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 128,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function main() {
  const diff = await getStagedDiff();

  if (!diff) {
    console.log(chalk.red('No staged changes found.'));
    return;
  }

  const message = await generateCommitMessage(diff);


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
