import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEditorUiStore = defineStore('editor-ui', () => {
  const isReadingMode = ref(false)

  function setReadingMode(value: boolean) {
    isReadingMode.value = value
  }

  return { isReadingMode, setReadingMode }
})
