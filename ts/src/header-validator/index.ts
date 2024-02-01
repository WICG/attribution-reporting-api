import { SourceType } from '../source-type'
import { Issue, PathComponent } from './context'
import * as vsv from '../vendor-specific-values'
import { validateSource, validateTrigger } from './validate-json'
import { validateEligible } from './validate-eligible'
import { validateOsRegistration } from './validate-os'

const form = document.querySelector('form')! as HTMLFormElement
const input = form.querySelector('textarea')! as HTMLTextAreaElement
const headerRadios = form.elements.namedItem('header')! as RadioNodeList
const sourceTypeRadios = form.elements.namedItem(
  'source-type'
)! as RadioNodeList
const errorList = document.querySelector('#errors')!
const warningList = document.querySelector('#warnings')!
const noteList = document.querySelector('#notes')!
const successDiv = document.querySelector('#success')!
const sourceTypeFieldset = document.querySelector(
  '#source-type'
)! as HTMLFieldSetElement

const pathfulTmpl = document.querySelector(
  '#pathful-issue'
) as HTMLTemplateElement

const flexCheckbox = form.elements.namedItem('flex') as HTMLInputElement

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

function validate(): void {
  sourceTypeFieldset.disabled = true
  flexCheckbox.disabled = true

  let result
  switch (headerRadios.value) {
    case 'source':
      sourceTypeFieldset.disabled = false
      flexCheckbox.disabled = false
      result = validateSource(
        input.value,
        vsv.Chromium,
        sourceType(),
        flexCheckbox.checked,
        /*noteInfoGain=*/true,
      )[0]
      break
    case 'trigger':
      flexCheckbox.disabled = false
      result = validateTrigger(
        input.value,
        vsv.Chromium,
        flexCheckbox.checked
      )[0]
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
  noteList.replaceChildren(...result.notes.map(makeLi))
}

form.addEventListener('input', validate)

document.querySelector('#linkify')!.addEventListener('click', async () => {
  const url = new URL(location.toString())
  url.search = ''
  url.searchParams.set('header', headerRadios.value)
  url.searchParams.set('json', input.value)

  if (url.searchParams.get('header') === 'source') {
    url.searchParams.set('source-type', sourceType())
  }

  url.searchParams.set('flex', flexCheckbox.checked.toString())

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

flexCheckbox.checked = params.get('flex') === 'true'

validate()
