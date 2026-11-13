import { createRemoteCheckpoint } from './utils/checkpoint';
import { describeError } from './utils/errors';

try {
  const checkpoint = createRemoteCheckpoint(process.env.STATE_PUSH_BRANCH ?? '');
  checkpoint().catch(error => { console.error(describeError(error)); process.exitCode = 1; });
} catch (error) {
  console.error(describeError(error));
  process.exitCode = 1;
}
