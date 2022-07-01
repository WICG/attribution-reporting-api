import { formatIssue } from './validate-json.js';

// Issue types
const ERROR = 'ERROR';
const WARNING = 'WARNING';

// red
const ERROR_COLOR = '\x1b[31m%s\x1b[0m';
// yellow
const WARNING_COLOR = '\x1b[33m%s\x1b[0m';
// green
const SUCCESS_COLOR = '\x1b[32m%s\x1b[0m';

function logHeader(header) {
  console.log(`\n`);
  console.log(`----------------------------------------------`);
  console.log(header);
  console.log(`----------------------------------------------`);
}

function logSuccess() {
  console.log(SUCCESS_COLOR, `✅ 0 ERRORS, 0 WARNINGS`);
}

function logIssues(issues, issuesType) {
  let color;
  let symbol;
  if (issuesType === ERROR) {
    color = ERROR_COLOR;
    symbol = '❌';
  } else if (issuesType === WARNING) {
    color = WARNING_COLOR;
    symbol = '⚠️';
  }
  const issuesCount = issues.length;
  console.log(
    `${symbol}  ${issuesCount} ${issuesType}${issuesCount > 1 ? 'S' : ''}:`
  );
  const issuesFormatted = issues.map((issue) => formatIssue(issue));
  issuesFormatted.forEach((issueFormatted) =>
    console.log(color, issueFormatted)
  );
}

export function logValidation(header, validationFunction) {
  // Log header
  logHeader(header);

  // Validate
  const { errors, warnings } = validationFunction(header);

  // Log validation output
  if (errors.length === 0 && warnings.length === 0) {
    logSuccess();
  }
  if (errors.length) {
    logIssues(errors, ERROR);
  }
  if (warnings.length) {
    logIssues(warnings, WARNING);
  }
}

export function logHeaderListValidation(headers, validationFunction) {
  headers.forEach((header) => {
    logValidation(header, validationFunction);
  });
}
