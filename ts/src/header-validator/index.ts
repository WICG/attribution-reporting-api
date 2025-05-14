import { SourceType, parseSourceType } from '../source-type'
import * as vsv from '../vendor-specific-values'
import { makeLi } from './issue-utils'
import * as eligible from './validate-eligible'
import * as info from './validate-info'
import * as os from './validate-os'
import * as source from './validate-source'
import * as trigger from './validate-trigger'
import * as validator from './validator'

const form = document.querySelector<HTMLFormElement>('form')!
const input = form.querySelector<HTMLTextAreaElement>('textarea')!
const headerRadios = form.elements.namedItem('header')! as RadioNodeList
const sourceTypeRadios = form.elements.namedItem(
  'source-type'
)! as RadioNodeList
const errorList = document.querySelector('#errors')!
const warningList = document.querySelector('#warnings')!
const noteList = document.querySelector('#notes')!
const successDiv = document.querySelector('#success')!
const sourceTypeFieldset =
  document.querySelector<HTMLFieldSetElement>('#source-type')!
const effective = document.querySelector('#effective')!

function sourceType(): SourceType {
  return parseSourceType(sourceTypeRadios.value)
}

function validate(): void {
  sourceTypeFieldset.disabled = true

  let v: validator.Validator<unknown>

  switch (headerRadios.value) {
    case 'source':
      sourceTypeFieldset.disabled = false
      v = source.validator({
        vsv: vsv.Chromium,
        sourceType: sourceType(),
        noteInfoGain: true,
      })
      break
    case 'trigger':
      v = trigger.validator({
        vsv: vsv.Chromium,
      })
      break
    case 'os-source':
    case 'os-trigger':
      v = os
      break
    case 'eligible':
      v = eligible
      break
    case 'info':
      v = info
      break
    default:
      return
  }

  const result = validator.validate(input.value, v)

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

  if (result.value === undefined) {
    effective.replaceChildren()
  } else {
    effective.textContent = result.value
  }
}

form.addEventListener('input', validate)

document.querySelector('#linkify')!.addEventListener('click', () => {
  const url = new URL(location.toString())
  url.search = ''
  url.searchParams.set('header', headerRadios.value)
  url.searchParams.set('json', input.value)

  if (url.searchParams.get('header') === 'source') {
    url.searchParams.set('source-type', sourceType())
  }

  void navigator.clipboard.writeText(url.toString())
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

validate()
