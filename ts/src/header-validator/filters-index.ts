import { SourceType } from '../source-type'
import { Context } from './context'
import * as filters from './filters'
import { makeLi } from './issue-utils'
import { validateJSON, filterPair, filterData } from './validate-json'

const form = document.querySelector<HTMLFormElement>('form')!
const sourceAgeInput = form.elements.namedItem(
  'source-age'
)! as HTMLInputElement
const filterDataInput = form.elements.namedItem(
  'filter-data'
)! as HTMLTextAreaElement
const filtersInput = form.elements.namedItem('filters')! as HTMLTextAreaElement
const sourceTypeRadios = form.elements.namedItem(
  'source-type'
)! as RadioNodeList
const sourceErrorList = document.querySelector('#source-errors')!
const sourceWarningList = document.querySelector('#source-warnings')!
const triggerErrorList = document.querySelector('#trigger-errors')!
const triggerWarningList = document.querySelector('#trigger-warnings')!
const matchesSpan = document.querySelector<HTMLElement>('#matches')!

function sourceType(): SourceType {
  const v = sourceTypeRadios.value
  if (v in SourceType) {
    return v as SourceType
  }
  throw new TypeError()
}

const minSourceAge = 0
const maxSourceAge = 30 * 24 * 60 * 60

function validate(): void {
  sourceErrorList.replaceChildren()
  sourceWarningList.replaceChildren()
  triggerErrorList.replaceChildren()
  triggerWarningList.replaceChildren()

  const sourceAge = sourceAgeInput.valueAsNumber
  if (!(sourceAge >= minSourceAge && sourceAge <= maxSourceAge)) {
    sourceErrorList.append(
      makeLi({
        msg: `source age must be in the range [${minSourceAge}, ${maxSourceAge}]`,
      })
    )
  }

  const [filterDataResult, parsedFilterData] = validateJSON(
    new Context(),
    filterDataInput.value,
    filterData
  )
  sourceErrorList.append(...filterDataResult.errors.map(makeLi))
  sourceWarningList.append(...filterDataResult.warnings.map(makeLi))

  const [filtersResult, parsedFilters] = validateJSON(
    new Context(),
    filtersInput.value,
    filterPair
  )
  triggerErrorList.append(...filtersResult.errors.map(makeLi))
  triggerWarningList.append(...filtersResult.warnings.map(makeLi))

  if (
    parsedFilterData.value === undefined ||
    parsedFilters.value === undefined
  ) {
    matchesSpan.innerText = 'false'
  } else {
    matchesSpan.innerText = filters
      .match(
        /*sourceTime=*/ 0,
        parsedFilterData.value,
        sourceType(),
        parsedFilters.value,
        /*triggerTime=*/ sourceAgeInput.valueAsNumber
      )
      .toString()
  }
}

form.addEventListener('input', validate)
validate()
