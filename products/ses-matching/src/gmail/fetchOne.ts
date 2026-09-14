/**
 * 開発用の手動実行エントリポイント: `npm run gmail:fetch-one`
 *
 * Gmail(実アカウント) -> 最新の1通だけ取得 -> RawEmail -> Parser -> 既存Validation
 * まで実際に流し、結果を確認するためのスクリプト。
 *
 * 重要: メール本文そのものは絶対にログへ出力しない。出力するのは
 * message id / threadId / from / subject / date / 本文の文字数、
 * Parserが判定した種別と「抽出できたフィールド名」、validation結果のみ。
 */

import { validateEngineerRecord } from '../intake/engineer';
import { validateProjectRecord } from '../intake/project';
import { dummyEngineers } from '../demo/dummyData';
import { matchProjectToEngineers } from '../matching/matchProjectToEngineers';
import { authenticate, getAccountEmail, getGmailService, getMessage, listMessages } from './client';
import { toRawEmail } from './parseMessage';
import { parseEmail } from '../parser/parseEmail';

async function main() {
  const auth = await authenticate();
  const service = getGmailService(auth);
  const account = await getAccountEmail(service);

  console.log(`account: ${account ?? '(unknown)'}`);

  const messages = await listMessages(service, 1);
  if (messages.length === 0 || !messages[0].id) {
    console.log('Gmail fetch: SUCCESS (mailbox is empty — no message to process)');
    return;
  }

  const message = await getMessage(service, messages[0].id);
  const email = toRawEmail(message);

  console.log('Gmail fetch: SUCCESS');
  console.log(`message id: ${email.id}`);
  console.log(`threadId:   ${email.threadId ?? '(none)'}`);
  console.log(`from:       ${email.from ?? '(none)'}`);
  console.log(`subject:    ${email.subject ?? '(none)'}`);
  console.log(`date:       ${email.date ?? '(none)'}`);
  console.log(`bodyLength: ${email.bodyText?.length ?? 0}`);

  const parsed = parseEmail(email);
  console.log('\nParser result:');
  console.log(`status: ${parsed.status}`);

  if (parsed.status === 'unparsed') {
    console.log(`reason: ${parsed.reason}`);
    return;
  }

  console.log(`type: ${parsed.recordType}`);
  const fieldNames = Object.keys(parsed.candidate).filter((key) => key !== 'id');
  console.log('extracted fields:');
  for (const name of fieldNames) {
    console.log(`- ${name}`);
  }

  if (parsed.recordType === 'project') {
    const result = validateProjectRecord(parsed.candidate);
    console.log(`\nvalidation: ${result.valid ? 'PASS' : 'FAIL'}`);
    if (!result.valid) {
      console.log('errors:');
      for (const err of result.errors) console.log(`- ${err}`);
      return;
    }

    const matches = matchProjectToEngineers(result.value, dummyEngineers);
    console.log('\nmatching against demo engineers (dummy data):');
    console.log(`top candidate: ${matches[0]?.engineerId ?? '(none)'} — score ${matches[0]?.score ?? '(n/a)'}`);
  } else {
    const result = validateEngineerRecord(parsed.candidate);
    console.log(`\nvalidation: ${result.valid ? 'PASS' : 'FAIL'}`);
    if (!result.valid) {
      console.log('errors:');
      for (const err of result.errors) console.log(`- ${err}`);
    }
  }
}

main().catch((err) => {
  console.error('Gmail fetch: FAILED');
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
