/**
 * Opens a native file picker and returns the chosen files.
 *
 * Safari fires `cancel` on a detached input (sometimes before `change`,
 * and also after a successful pick). Ignore an empty cancel until `change`
 * has had a chance to run.
 */
export function pickFiles(options: { accept: string; multiple?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = options.accept
    input.multiple = options.multiple === true
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }

    input.addEventListener('change', () => {
      finish(input.files ? Array.from(input.files) : [])
    })
    input.addEventListener('cancel', () => {
      window.setTimeout(() => {
        if (input.files && input.files.length > 0) {
          finish(Array.from(input.files))
          return
        }
        finish([])
      }, 0)
    })

    input.click()
  })
}
