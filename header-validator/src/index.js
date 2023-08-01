import { validateJSON, validateSource, validateTrigger } from './validate-json.js';
import { validateEligible } from './validate-eligible.js';
import { validateOsRegistration } from './validate-os.js';

const form = document.querySelector('form');
const input = form.querySelector('textarea');
const errorList = document.querySelector('#errors');
const warningList = document.querySelector('#warnings');
const successDiv = document.querySelector('#success');

const pathfulTmpl = document.querySelector('#pathful-issue');

const pathPart = p =>
  typeof p === 'string' ? `["${p}"]` : `[${p}]`;

const makeLi = ({path, msg}) => {
  let li;

  if (path instanceof Array) {
    if (path.length === 0) {
      li = document.createElement('li');
      li.textContent = `JSON root ${msg}`;
    } else {
      li = pathfulTmpl.content.cloneNode(true);
      li.querySelector('code').textContent = path.map(pathPart).join('');
      li.querySelector('span').textContent = msg;
    }
  } else {
    li = document.createElement('li');
    li.textContent = msg;
  }

  return li;
};

const header = () => form.elements['header'].value;

form.addEventListener('input', () => {
  let result;
  switch (header()) {
  case 'source':
    result = validateJSON(input.value, validateSource);
    break;
  case 'trigger':
    result = validateJSON(input.value, validateTrigger);
    break;
  case 'os-source':
    result = validateOsRegistration(input.value);
    break;
  case 'os-trigger':
    result = validateOsRegistration(input.value);
    break;
  case 'eligible':
    result = validateEligible(input.value);
    break;
  default:
    return;
  }

  const successEl = document.createElement('div');
  if (result?.errors?.length === 0 && result?.warnings?.length === 0) {
    successEl.textContent = 'The header is valid.';
  } else {
    successEl.textContent = '';
  }
  successDiv.replaceChildren(successEl);

  errorList.replaceChildren(...result.errors.map(makeLi));
  warningList.replaceChildren(...result.warnings.map(makeLi));
});

document.querySelector('#linkify').addEventListener('click', async () => {
  const url = new URL(location);
  url.search = '';
  url.searchParams.set('header', header());
  url.searchParams.set('json', input.value);
  await navigator.clipboard.writeText(url.toString());
});

// Note: The `json` and `header` query params are relied on by DevTools as of
// https://crrev.com/c/devtools/devtools-frontend/+/4076187, so they must not
// be changed in an incompatible way.
const params = new URLSearchParams(location.search);

const json = params.get('json');
if (json) {
  input.value = json;
}

switch (params.get('header')) {
case 'eligible':
  form.querySelector('input[value=eligible]').click();
  break;
case 'os-source':
  form.querySelector('input[value=os-source]').click();
  break;
case 'os-trigger':
  form.querySelector('input[value=os-trigger]').click();
  break;
case 'trigger':
  form.querySelector('input[value=trigger]').click();
  break;
default:
  form.querySelector('input[value=source]').click();
  break;
}
