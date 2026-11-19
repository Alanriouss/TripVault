import { readFileSync } from 'node:fs';

process.env.TRIPVAULT_TEST_HTML ||= 'public/index.html';
const { launch } = await import('../work/tripvault-test-harness.js');
const { testDemoUi } = await import('../work/test-tripvault-demo-ui.js');
await testDemoUi({ launch, supportsWalletExit: true });
const staticSource = readFileSync('docs/index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
await testDemoUi({ launch: options => launch(options, staticSource), supportsWalletExit: false });
