import { Issue, PathComponent } from './context'

const pathfulTmpl = document.querySelector(
  '#pathful-issue'
) as HTMLTemplateElement

function pathPart(p: PathComponent): string {
  return typeof p === 'string' ? `["${p}"]` : `[${p}]`
}

export function makeLi({ path, msg }: Issue): HTMLElement {
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
