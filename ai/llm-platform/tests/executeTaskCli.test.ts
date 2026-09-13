import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const cliPath = path.join(projectRoot, 'llm/src/cli.ts');

function runCli(input: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', cliPath], {
      cwd: projectRoot,
      encoding: 'utf-8',
      input,
      timeout: 15_000,
    });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? '', status: e.status ?? 1 };
  }
}

/**
 * Exercises `execute-task` as a real child process, exactly the way an
 * external caller (e.g. the Automation Engine, via Python's `subprocess`)
 * would invoke it — stdin in, stdout out, no mocking of the CLI itself.
 * Only cases that don't require a reachable model are covered here (the
 * real-Ollama success/error paths were verified manually — see the
 * README's "Verified real-model run" section — since they depend on what
 * happens to be installed on the machine running the tests).
 */
describe('execute-task CLI', () => {
  it('runs the deterministic gate end to end for empty input, with no model call needed', () => {
    const { stdout, status } = runCli(JSON.stringify({ task_type: 'classify', domain: 'general', input: '   ' }));
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.output.category).toBe('other');
    expect(parsed.trace.providerKind).toBe('deterministic');
  });

  it('reports INVALID_JSON for malformed stdin instead of crashing', () => {
    const { stdout, status } = runCli('{not valid json');
    expect(status).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error.code).toBe('INVALID_JSON');
  });

  it('reports UNSUPPORTED_TASK_TYPE for a task_type the Router has no pipeline for', () => {
    const { stdout, status } = runCli(JSON.stringify({ task_type: 'generate', domain: 'general', input: 'hello' }));
    expect(status).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error.code).toBe('UNSUPPORTED_TASK_TYPE');
  });
});
