import { Issue, PathComponent } from './issue'
import { validateJSON, validateSource, validateTrigger } from './validate-json'
import { validateEligible } from './validate-eligible'
import { validateOsRegistration } from './validate-os'

const form = document.querySelector('form')
const input = form.querySelector('textarea')
const errorList = document.querySelector('#errors')
const warningList = document.querySelector('#warnings')
const successDiv = document.querySelector('#success')

const pathfulTmpl = document.querySelector('#pathful-issue') as HTMLTemplateElement

function pathPart(p: PathComponent): string {
  return typeof p === 'string' ? `["${p}"]` : `[${p}]`
}

function makeLi({path, msg}: Issue): HTMLElement {
  let li

  if (Array.isArray(path)) {
    if (path.length === 0) {
      li = document.createElement('li')
      li.textContent = `JSON root ${msg}`
    } else {
      li = pathfulTmpl.content.cloneNode(true)
      li.querySelector('code').textContent = path.map(pathPart).join('')
      li.querySelector('span').textContent = msg
    }
  } else {
    li = document.createElement('li')
    li.textContent = msg
  }

  return li
}

function header(): string { return form.elements['header'].value }

form.addEventListener('input', () => {
  let result
  switch (header()) {
  case 'source':
    result = validateJSON(input.value, validateSource)
    break
  case 'trigger':
    result = validateJSON(input.value, validateTrigger)
    break
  case 'os-source':
    result = validateOsRegistration(input.value)
    break
  case 'os-trigger':
    result = validateOsRegistration(input.value)
    break
  case 'eligible':
    result = validateEligible(input.value)
    break
  default:
    return
  }

  const successEl = document.createElement('div')
  if (result.errors.length === 0 && result.warnings.length === 0) {
    successEl.textContent = 'The header is valid.'
  } else {
    successEl.textContent = ''
  }
  successDiv.replaceChildren(successEl)

  errorList.replaceChildren(...result.errors.map(makeLi))
  warningList.replaceChildren(...result.warnings.map(makeLi))
})

document.querySelector('#linkify').addEventListener('click', async () => {
  const url = new URL(location.toString())
  url.search = ''
  url.searchParams.set('header', header())
  url.searchParams.set('json', input.value)
  await navigator.clipboard.writeText(url.toString())
})

// Note: The `json` and `header` query params are relied on by DevTools as of
// https://crrev.com/c/devtools/devtools-frontend/+/4076187, so they must not
// be changed in an incompatible way.
const params = new URLSearchParams(location.search)

const json = params.get('json')
if (json) {
  input.value = json
}

const allowedValues = new Set([
  'eligible',
  'os-source',
  'os-trigger',
  'source',
  'trigger',
])

let selection = params.get('header')
if (!allowedValues.has(selection)) {
  selection = 'source'
}
(form.querySelector(`input[value=${selection}]`) as HTMLInputElement).click()
