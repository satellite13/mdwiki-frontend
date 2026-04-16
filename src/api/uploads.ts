import client from './client'

type UploadResponse = {
  url: string
}

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await client.post<UploadResponse>('/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return response.data.url
}
