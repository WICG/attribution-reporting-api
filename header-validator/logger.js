import { formatIssue } from './validate-json.js';

export function logValidation(header, validationFunction) {
  console.log(`\n`);
  console.log(`----------------------------------------------`);
  console.log(header);
  console.log(`----------------------------------------------`);

  const { errors, warnings } = validationFunction(header);

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\x1b[32m%s\x1b[0m', `✅ 0 ERRORS, 0 WARNINGS`);
  }

  if (errors.length) {
    console.log(`❌ ${errors.length} ERROR(S):`);
    const errorsFormatted = errors.map((error) => formatIssue(error));
    errorsFormatted.forEach((errorFormatted) =>
      console.log('\x1b[31m%s\x1b[0m', errorFormatted)
    );
  }

  if (warnings.length) {
    console.log(`⚠️  ${warnings.length} WARNING(S):`);
    const warningsFormatted = warnings.map((warning) => formatIssue(warning));
    warningsFormatted.forEach((warningFormatted) =>
      console.log('\x1b[33m%s\x1b[0m', warningFormatted)
    );
  }
}

export function logHeaderListValidation(headers, validationFunction) {
  headers.forEach((header) => {
    logValidation(header, validationFunction);
  });
}
