let API_URL
let WEBSITE_URL
let CUSTOM_NODES_FILES_URL
let isConfigured = false

self.addEventListener('message', (event) => {
  console.log('RECEIVED MESSAGE:', event.data)
  if (event.data.type === 'CONFIG') {
    API_URL = event.data.apiUrl
    WEBSITE_URL = event.data.websiteUrl
    CUSTOM_NODES_FILES_URL = event.data.customNodesFilesUrl
    isConfigured = true
    console.log('Service Worker configured with API URL:', API_URL)
    console.log('Service Worker configured with Website URL:', WEBSITE_URL)
    console.log(
      'Service Worker configured with Custom Nodes Files URL:',
      CUSTOM_NODES_FILES_URL
    )
  }
})

// Add logic to skip waiting and activate the new version immediately
self.addEventListener('install', (event) => {
  self.skipWaiting() // Forces the new SW to activate immediately
  // console.log('Service Worker installed');
})

self.addEventListener('activate', (event) => {
  // console.log('Service Worker activated');
  self.clients.claim() // Takes control of pages immediately
})

const extensionsCoreFiles = [
  'clipspace.js',
  'groupNode.js',
  'groupNodeManage.js',
  'maskEditorOld.js',
  'widgetInputs.js'
]

// Hijack fetch requests
self.addEventListener('fetch', (event) => {
  // Skip handling if not configured yet
  if (!isConfigured) {
    return
  }

  const url = new URL(event.request.url)
  if (url.host === new URL(CUSTOM_NODES_FILES_URL).host) {
    if (url.pathname.startsWith('/extensions/')) {
      // console.log("returning extension:", url.href)
      fetchExtension(event)
    } else if (url.pathname.startsWith('/rgthree/')) {
      if (url.pathname == '/rgthree/config.js') {
        forwardEventToApi(event)
      } else {
        fetchRgthreeRoute(event)
      }
    }
  }
})

// forward to localhost:3100
async function forwardEventToApi(event) {
  const url = new URL(event.request.url)
  const apiUrl = new URL(url.pathname, API_URL)

  event.respondWith(
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status} for ${apiUrl} at forwardEventToApi`
          )
        }
        return response
      })
      .catch((error) => {
        console.error('API fetch failed:', error)
        return new Response('API fetch failed', { status: 500 })
      })
  )
}

async function fetchExtension(event) {
  const url = new URL(event.request.url)

  // TODO: This mapping should be loaded from server.py
  const mapping = {
    'cg-use-everywhere': 'cg-use-everywhere/js',
    'ComfyUI-Impact-Pack': 'comfyui-impact-pack/js',
    ComfyUI_essentials: 'ComfyUI_essentials/js',
    'efficiency-nodes-comfyui': 'efficiency-nodes-comfyui/js',
    'times-two': 'times-two/web/js',
    'rgthree-comfy': 'rgthree-comfy/web/comfyui'
  }

  // Extract the path from the URL and split it into segments
  const pathSegments = url.pathname.split('/').filter((segment) => segment)

  // The extension name should be the first segment after removing empty strings
  let extensionName = pathSegments[1]
  const extensionPath = mapping[extensionName]

  if (!extensionPath) {
    console.warn(`Extension not found: ${extensionName}, path: ${url.pathname}`)
    event.respondWith(new Response('Extension not found', { status: 404 }))
    return
  }

  // Get the file path by joining all segments after the extension name
  const filePath = pathSegments.slice(2).join('/')

  // Create the new URL first
  const newUrl = new URL(
    `/custom_nodes/${extensionPath}/${filePath}`,
    WEBSITE_URL
  )

  // Fetch the file from the new URL
  event.respondWith(
    fetch(newUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status} for ${newUrl} at fetchExtension`
          )
        }

        // Only process JavaScript files
        if (response.headers.get('content-type')?.includes('javascript')) {
          const text = await response.text()
          // Rewrite relative imports to use the remapped path
          const modifiedText = parseImports(text, url)
          return new Response(modifiedText, {
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'no-cache' // Prevent caching to ensure we always process imports
            }
          })
        }

        return response
      })
      .catch((error) => {
        console.error(`Error serving extension file:`, error)
        return new Response('Error serving extension file', { status: 500 })
      })
  )
  return
}

// this function parses rgthree routes
// rgthree routes are of the form /rgthree/{path}/{subdir}/{file}.js
function fetchRgthreeRoute(event) {
  const url = new URL(event.request.url)
  const importPath = parseRgthreeRoute(url.pathname)
  const newUrl = new URL(importPath, WEBSITE_URL)
  event.respondWith(
    fetch(newUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status} for ${newUrl} at fetchRgthreeRoute`
          )
        }

        if (response.headers.get('content-type')?.includes('javascript')) {
          const text = await response.text()
          const modifiedText = parseImports(text, url)
          return new Response(modifiedText, {
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'no-cache'
            }
          })
        }

        return response
      })
      .catch((error) => {
        console.error(`Error serving rgthree route:`, error)
        return new Response('Error serving rgthree route', { status: 500 })
      })
  )
  return
}

// this is a special case for rgthree-comfy mapped from python code
// see rgthree_server.py, utils_server.py
// I tried to use the same logic and variable names as in python
function parseRgthreeRoute(importPath) {
  const path = importPath.split('/')[2]
  const segments = importPath.split('/').slice(3, -1) // Get all segments between path and filename
  const subdir = segments.length ? segments.join('/') + '/' : '' // Create subdir path with trailing slash if exists
  const file = importPath.split('/').pop()
  // console.log(importPath, "path:", path, "subdir:", subdir, "file:", file)
  return `/custom_nodes/rgthree-comfy/web/${path}/${subdir}${file}`
}

function parseImports(text, url) {
  return text.replace(
    /(import\s+(?:(?:\{[^}]*\}|\*\s+as\s+[^,\s]+|\w+)\s*,?\s*)*from\s+['"])(\.[^'"]+)(['"])/g,
    (match, importStart, importPath, importEnd) => {
      // Convert relative path to absolute path based on the original file's url
      let newImportPath = new URL(importPath, url.href).pathname
      return `${importStart}${newImportPath}${importEnd}`
    }
  )
}
