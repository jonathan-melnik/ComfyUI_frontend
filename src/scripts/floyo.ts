import axios from 'axios'

const floyo = {
  axios: axios.create(),
  userId: null as string | null,

  initialize() {
    // Get userId from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const userId = urlParams.get('userId') || import.meta.env.VITE_FLOYO_USER_ID
    this.axios.defaults.headers.common['X-Floyo-User-Id'] = userId
    this.axios.defaults.headers.common['ngrok-skip-browser-warning'] =
      'hello world'
  },

  /**
   * Sends a login request to the backend.
   * The login endpoint (e.g. /login) should set/reset the session cookie.
   */
  async login(loginUrl: string): Promise<any> {
    // Get userId from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    this.userId = urlParams.get('userId') || import.meta.env.VITE_FLOYO_USER_ID

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
  }
}

export default floyo
