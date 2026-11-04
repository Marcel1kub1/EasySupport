const endpoint = 'https://gateway.kilo.ai/v1/chat/completions';
const model = 'kilo-auto/free';

async function callKilo(prompt) {
  const token = process.env.KILO_API_TOKEN;
  if (!token) {
    throw new Error('KILO_API_TOKEN environment variable is not set.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kilo Gateway error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      options.mode = argv[++i];
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.mode) {
    throw new Error('Provide --mode (questions|evaluate|summary).');
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const issueTitle = process.env.ISSUE_TITLE || '';
  const issueBody = process.env.ISSUE_BODY || '';

  if (options.mode === 'questions') {
    const prompt = `A user opened this issue on the EasySupport GitHub repository (a self-hosted Discord ticketing bot):

Title: ${issueTitle}
Body: ${issueBody}

As a project maintainer, reply with clarifying questions to gather all information needed to understand, reproduce, and act on this issue. Ask only the most essential questions (maximum 5). Be friendly and helpful. Write your response as a GitHub comment in Markdown.`;

    const response = await callKilo(prompt);
    process.stdout.write(response);
  } else if (options.mode === 'evaluate') {
    const prompt = `Review this GitHub issue and determine if the user has provided enough information for a developer to act on it:

Title: ${issueTitle}
Body: ${issueBody}

Reply with exactly one of these two lines at the top of your response:
- SUFFICIENT: yes   (if the issue has enough detail to act on)
- SUFFICIENT: no    (if more information is needed from the user)

Then briefly explain your reasoning.`;

    const response = await callKilo(prompt);
    process.stdout.write(response);
  } else if (options.mode === 'summary') {
    const prompt = `A user has provided all the information needed for this issue on the EasySupport repository. Create a structured summary for developers:

Title: ${issueTitle}
Body: ${issueBody}

Write a Markdown summary with these sections:
1. **Issue type** (bug report, feature request, question, other)
2. **Steps to reproduce** (if a bug)
3. **Expected behavior**
4. **Actual behavior**
5. **Environment** (Discord guild size, Node version, etc. if mentioned)
6. **Suggested priority** (low, medium, high, critical)

Keep it concise and actionable for a developer.`;

    const response = await callKilo(prompt);
    process.stdout.write(response);
  } else {
    throw new Error(`Unknown mode: ${options.mode}`);
  }
}

main().catch((error) => {
  console.error(`[triage-issue] ${error.message}`);
  process.exitCode = 1;
});
