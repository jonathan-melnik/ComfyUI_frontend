import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'timestwo',
  async setup() {
    console.log('timestwo setup')
    function messageHandler(event) {
      alert(event.detail.message)
    }
    app.api.addEventListener('mensajito', messageHandler)
  }
})
