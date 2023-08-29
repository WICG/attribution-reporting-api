import { Issue, PathComponent } from './context'
import {
  SourceType,
  VendorSpecificValues,
  validateJSON,
  validateSource,
  validateTrigger,
} from './validate-json'
import { validateEligible } from './validate-eligible'
import { validateOsRegistration } from './validate-os'

const form = document.querySelector('form')! as HTMLFormElement
const input = form.querySelector('textarea')! as HTMLTextAreaElement
const useChromiumVsvCheckbox = document.querySelector(
  '#chromium-vsv'
)! as HTMLInputElement
const errorList = document.querySelector('#errors')!
const warningList = document.querySelector('#warnings')!
const successDiv = document.querySelector('#success')!

const pathfulTmpl = document.querySelector(
  '#pathful-issue'
) as HTMLTemplateElement

function pathPart(p: PathComponent): string {
  return typeof p === 'string' ? `["${p}"]` : `[${p}]`
}

function makeLi({ path, msg }: Issue): HTMLElement {
  let li

  if (Array.isArray(path)) {
    if (path.length === 0) {
      li = document.createElement('li')
      li.textContent = msg
    } else {
      li = pathfulTmpl.content.cloneNode(true) as HTMLElement
      li.querySelector('code')!.textContent = path.map(pathPart).join('')
      li.querySelector('span')!.textContent = msg
    }
  } else {
    li = document.createElement('li')
    li.textContent = msg
  }

  return li
}

function header(): string {
  const el = form.elements.namedItem('header')! as RadioNodeList
  return el.value
}

const ChromiumVsv: VendorSpecificValues = {
  maxAggregationKeysPerAttribution: 20,
  triggerDataCardinality: {
    [SourceType.event]: 2n,
    [SourceType.navigation]: 8n,
  },
}

function validate(): void {
  const vsv: Partial<VendorSpecificValues> = useChromiumVsvCheckbox.checked
    ? ChromiumVsv
    : {}

  let result
  switch (header()) {
    case 'source':
      result = validateJSON(input.value, validateSource, vsv)
      break
    case 'trigger':
      result = validateJSON(input.value, validateTrigger, vsv)
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
}

useChromiumVsvCheckbox.addEventListener('change', validate)
form.addEventListener('input', validate)

document.querySelector('#linkify')!.addEventListener('click', async () => {
  const url = new URL(location.toString())
  url.search = ''
  url.searchParams.set('header', header())
  url.searchParams.set('json', input.value)

  if (useChromiumVsvCheckbox.checked) {
    url.searchParams.set('vsv', 'chromium')
  }

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

const vsv = params.get('vsv')
if (vsv === 'chromium') {
  useChromiumVsvCheckbox.checked = true
}

const allowedValues = new Set([
  'eligible',
  'os-source',
  'os-trigger',
  'source',
  'trigger',
])

let selection = params.get('header')
if (selection === null || !allowedValues.has(selection)) {
  selection = 'source'
}
;(form.querySelector(`input[value=${selection}]`) as HTMLInputElement).click()
