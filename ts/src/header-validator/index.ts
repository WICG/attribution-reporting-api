import { SourceType } from '../source-type'
import { Issue, PathComponent } from './context'
import {
  VendorSpecificValues,
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
const headerRadios = form.elements.namedItem('header')! as RadioNodeList
const sourceTypeRadios = form.elements.namedItem(
  'source-type'
)! as RadioNodeList
const errorList = document.querySelector('#errors')!
const warningList = document.querySelector('#warnings')!
const successDiv = document.querySelector('#success')!
const sourceTypeFieldset = document.querySelector(
  '#source-type'
)! as HTMLFieldSetElement

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

function sourceType(): SourceType {
  const v = sourceTypeRadios.value
  if (v in SourceType) {
    return v as SourceType
  }
  throw new TypeError()
}

const ChromiumVsv: VendorSpecificValues = {
  defaultEventLevelAttributionsPerSource: {
    [SourceType.event]: 1,
    [SourceType.navigation]: 3,
  },
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

  sourceTypeFieldset.disabled = true

  let result
  switch (headerRadios.value) {
    case 'source':
      sourceTypeFieldset.disabled = false
      result = validateSource(input.value, vsv, sourceType())[0]
      break
    case 'trigger':
      result = validateTrigger(input.value, vsv)[0]
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
  url.searchParams.set('header', headerRadios.value)
  url.searchParams.set('json', input.value)

  if (useChromiumVsvCheckbox.checked) {
    url.searchParams.set('vsv', 'chromium')
  }

  if (url.searchParams.get('header') === 'source') {
    url.searchParams.set('source-type', sourceType())
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
headerRadios.value = selection

let st = params.get('source-type')
if (st !== null && st in SourceType) {
  st = st as SourceType
} else {
  st = SourceType.event
}
sourceTypeRadios.value = st

validate()
