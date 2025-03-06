import axios from 'axios'

const floyo = {
  axios: axios.create(),
  userId: null as string | null,

  async loadImage(url: string) {
    const response = await this.axios.get(url, {
      responseType: 'blob' // Tell Axios to return a Blob
    })
    return URL.createObjectURL(response.data)
  },

  async loadModuleWithAuth(url: string) {
    // Fetch the module code with the custom header
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to load module: ${response.statusText}`)
    }

    // Get the module code as text
    const code = await response.text()

    // Create a Blob from the code
    const blob = new Blob([code], { type: 'application/javascript' })

    // Create an object URL for the Blob
    const blobUrl = URL.createObjectURL(blob)

    // Dynamically import the module from the Blob URL
    const module = await import(/* @vite-ignore */ blobUrl)

    // Optionally, revoke the Blob URL if it’s no longer needed
    URL.revokeObjectURL(blobUrl)

    return module
  }
}

export default floyo
