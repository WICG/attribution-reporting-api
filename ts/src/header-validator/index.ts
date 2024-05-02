import { SourceType } from '../source-type'
import { ValidationResult } from './context'
import * as vsv from '../vendor-specific-values'
import { Maybe } from './maybe'
import { makeLi } from './issue-utils'
import { validateSource, validateTrigger } from './validate-json'
import { serializeEligible, validateEligible } from './validate-eligible'
import { serializeOsRegistration, validateOsRegistration } from './validate-os'
import { serializeInfo, validateInfo } from './validate-info'
import { serializeSource, serializeTrigger } from './to-json'

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
const effective = document.querySelector('#effective')!

const flexCheckbox = form.elements.namedItem('flex') as HTMLInputElement

function sourceType(): SourceType {
  const v = sourceTypeRadios.value
  if (v in SourceType) {
    return v as SourceType
  }
  throw new TypeError()
}

function transformResult<T>(
  r: [ValidationResult, Maybe<T>],
  f: (v: T) => string
): [ValidationResult, Maybe<string>] {
  return [r[0], r[1].map(f)]
}

function validate(): void {
  sourceTypeFieldset.disabled = true
  flexCheckbox.disabled = true

  let result
  switch (headerRadios.value) {
    case 'source':
      sourceTypeFieldset.disabled = false
      flexCheckbox.disabled = false
      result = transformResult(
        validateSource(
          input.value,
          vsv.Chromium,
          sourceType(),
          flexCheckbox.checked,
          /*noteInfoGain=*/ true
        ),
        (source) =>
          JSON.stringify(
            serializeSource(source, flexCheckbox.checked),
            /*replacer=*/ null,
            '  '
          )
      )
      break
    case 'trigger':
      flexCheckbox.disabled = false
      result = transformResult(
        validateTrigger(input.value, vsv.Chromium, flexCheckbox.checked),
        (trigger) =>
          JSON.stringify(
            serializeTrigger(trigger, flexCheckbox.checked),
            /*replacer=*/ null,
            '  '
          )
      )
      break
    case 'os-source':
    case 'os-trigger':
      result = transformResult(
        validateOsRegistration(input.value),
        serializeOsRegistration
      )
      break
    case 'eligible':
      result = transformResult(validateEligible(input.value), serializeEligible)
      break
    case 'info':
      result = transformResult(validateInfo(input.value), serializeInfo)
      break
    default:
      return
  }

  const successEl = document.createElement('div')
  if (result[0].errors.length === 0 && result[0].warnings.length === 0) {
    successEl.textContent = 'The header is valid.'
  } else {
    successEl.textContent = ''
  }
  successDiv.replaceChildren(successEl)

  errorList.replaceChildren(...result[0].errors.map(makeLi))
  warningList.replaceChildren(...result[0].warnings.map(makeLi))
  noteList.replaceChildren(...result[0].notes.map(makeLi))

  if (result[1].value === undefined) {
    effective.replaceChildren()
  } else {
    effective.textContent = result[1].value
  }
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
