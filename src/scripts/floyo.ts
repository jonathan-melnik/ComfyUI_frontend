import axios from 'axios'

const floyo = {
  axios: axios.create(),
  userId: null as string | null,

  initialize() {
    // Get userId from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    this.userId = urlParams.get('userId') || import.meta.env.VITE_FLOYO_USER_ID
    this.axios.defaults.headers.common['X-Floyo-User-Id'] = this.userId
  },

  /**
   * Sends a login request to the backend.
   * The login endpoint (e.g. /login) should set/reset the session cookie.
   */
  async login(loginUrl: string): Promise<any> {
    if (!this.userId) {
      throw new Error(
        'No userId provided in URL params or environment variables!'
      )
    }

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: this.userId })
    })

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = await response.json()
    console.log('Logged in as', this.userId, data)
    return data
  },

  async loadImage(url: string) {
    const response = await this.axios.get(url, {
      responseType: 'blob' // Tell Axios to return a Blob
    })
    return URL.createObjectURL(response.data)
  },

  async loadModuleWithAuth(url: string) {
    // Fetch the module code with the custom header
    const response = await fetch(url, {
      headers: { 'X-Floyo-User-Id': this.userId || '' }
    })

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
