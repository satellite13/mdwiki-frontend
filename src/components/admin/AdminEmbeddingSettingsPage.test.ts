import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminEmbeddingSettingsPage from './AdminEmbeddingSettingsPage.vue'

const mockGetEmbeddingSettings = vi.fn()
const mockUpdateEmbeddingSettings = vi.fn()
const mockAlert = vi.fn()

vi.mock('@/api/embeddingSettings', () => ({
  getEmbeddingSettings: (...args: unknown[]) => mockGetEmbeddingSettings(...args),
  updateEmbeddingSettings: (...args: unknown[]) => mockUpdateEmbeddingSettings(...args)
}))

vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({
    alert: mockAlert
  })
}))

describe('AdminEmbeddingSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEmbeddingSettings.mockResolvedValue({
      data: {
        provider: 'openai',
        model: 'text-embedding-3-small',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyConfigured: true,
        expectedDimension: 1536
      }
    })
    mockUpdateEmbeddingSettings.mockResolvedValue({
      data: {
        provider: 'ollama',
        model: 'nomic-embed-text',
        baseUrl: 'http://localhost:11434',
        apiKeyConfigured: true,
        expectedDimension: 1536,
        warning: {
          code: 'EMBEDDING_DIMENSION_MISMATCH',
          message: 'dimension mismatch',
          expectedDimension: 1536,
          actualDimension: 768
        }
      }
    })
  })

  it('loads settings and saves with mismatch warning', async () => {
    const wrapper = mount(AdminEmbeddingSettingsPage, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>'
          }
        }
      }
    })
    await flushPromises()

    const providerSelect = wrapper.find('select')
    const modelInput = wrapper.find('input[required]')
    const baseUrlInput = wrapper.find('input[type="url"]')
    const apiKeyInput = wrapper.find('input[type="password"]')
    expect((providerSelect.element as HTMLSelectElement).value).toBe('openai')
    expect((modelInput.element as HTMLInputElement).value).toBe('text-embedding-3-small')
    expect((baseUrlInput.element as HTMLInputElement).value).toBe('https://api.openai.com/v1')
    expect((apiKeyInput.element as HTMLInputElement).value).toBe('')

    await providerSelect.setValue('ollama')
    await modelInput.setValue('nomic-embed-text')
    await baseUrlInput.setValue('http://localhost:11434')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockUpdateEmbeddingSettings).toHaveBeenCalledWith({
      provider: 'ollama',
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434'
    })
    expect(mockAlert).toHaveBeenCalled()
    const alertMessage = mockAlert.mock.calls[0]?.[0] as string
    expect(alertMessage).toContain('Provider returned 768 dimensions')
    expect(alertMessage).toContain('reindex')
  })
})
