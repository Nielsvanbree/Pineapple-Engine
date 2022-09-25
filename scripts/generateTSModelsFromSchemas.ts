import { convertFromDirectory } from 'joi-to-typescript';

async function generateTSModelsFromSchemas(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Running joi-to-typescript...');

  // Configure your settings here
  const result = await convertFromDirectory({
    schemaDirectory:  './examples/payment/pineappleConfig',
    typeOutputDirectory: './examples/payment/tsModels',
    inputFileFilter: /schemas.ts/,
    debug: true
  });

  if (result) {
    // eslint-disable-next-line no-console
    console.log('Completed joi-to-typescript');
  } else {
    // eslint-disable-next-line no-console
    console.log('Failed to run joi-to-typescrip');
  }
}

generateTSModelsFromSchemas();