#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)

// Convert fs promises to use ES modules
const readFile = fs.promises.readFile
const writeFile = fs.promises.writeFile
const mkdir = fs.promises.mkdir

// Extension mapping (same as in service worker)
const mapping = {
  'cg-use-everywhere': 'cg-use-everywhere/js',
  'ComfyUI-Impact-Pack': 'comfyui-impact-pack/js',
  ComfyUI_essentials: 'ComfyUI_essentials/js',
  'efficiency-nodes-comfyui': 'efficiency-nodes-comfyui/js',
  'times-two': 'times-two/web/js',
  'rgthree-comfy': 'rgthree-comfy/web/comfyui'
}

// Configuration
let SOURCE_DIR
let OUTPUT_DIR
const processedFiles = new Set()

// Extract imports from a JavaScript file
function extractImports(content) {
  const importRegex =
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+[^,\s]+|\w+)\s*,?\s*)*from\s+['"]([^'"]+)['"]/g
  const imports = []
  let match

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  return imports
}

// Rewrite imports in JavaScript content
function rewriteImports(content, filePath) {
  return content.replace(
    /(import\s+(?:(?:\{[^}]*\}|\*\s+as\s+[^,\s]+|\w+)\s*,?\s*)*from\s+['"])(\.[^'"]+)(['"])/g,
    (match, importStart, importPath, importEnd) => {
      // Convert relative path to absolute path based on the file's directory
      const importDir = path.dirname(filePath)
      const absoluteImportPath = path
        .normalize(path.join(importDir, importPath))
        .replace(/\\/g, '/') // Replace all backslashes with forward slashes

      // Make sure the path starts with a single slash
      const formattedPath = absoluteImportPath.startsWith('/')
        ? absoluteImportPath
        : '/' + absoluteImportPath

      return `${importStart}${formattedPath}${importEnd}`
    }
  )
}

// Special case for rgthree routes
function parseRgthreeRoute(importPath) {
  const pathPart = importPath.split('/')[2]
  const segments = importPath.split('/').slice(3, -1)
  const subdir = segments.length ? segments.join('/') + '/' : ''
  const file = importPath.split('/').pop()
  return `/custom_nodes/rgthree-comfy/web/${pathPart}/${subdir}${file}`
}

// Process a single file and its imports recursively
async function processFile(filePath, requestedPath) {
  console.log('processing file: ', filePath)
  // Skip if already processed
  if (processedFiles.has(filePath)) {
    return
  }
  // Mark as processed
  processedFiles.add(filePath)

  if (requestedPath == '/rgthree/config.js') {
    // this is a special case, that will be resolved by the api(comfyui python server)
    // see routes_config.py(it generates js code at runtime based on python config file)
    return
  }

  // Handle special cases
  if (requestedPath.startsWith('/rgthree/')) {
    filePath = parseRgthreeRoute(filePath)
  }

  try {
    // Determine source and output paths
    const outputPath = path.join(
      OUTPUT_DIR,
      filePath.startsWith('/') ? filePath.slice(1) : filePath
    )

    // Create output directory if it doesn't exist
    await mkdir(path.dirname(outputPath), { recursive: true })

    // Read the file content
    let content
    try {
      content = await readFile(filePath, 'utf8')
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message)
      return
    }

    // Only process JavaScript files
    if (filePath.endsWith('.js')) {
      // Rewrite file content with absolute paths(they will be relative to extensions/, that we'll later change to custom_nodes/...)
      content = rewriteImports(content, requestedPath)
      const imports = extractImports(content)

      // Process each import
      for (const importPath of imports) {
        console.log('importPath: ', importPath)
        if (importPath.startsWith('/extensions/')) {
          await processExtension(importPath)
        }
        // Skip non-relative imports
        // if (!importPath.startsWith('.')) continue;

        // Resolve the import path relative to the current file
        // const importDir = path.dirname(filePath);
        // console.log("importDir: ", importDir);
        // const resolvedImport = path.normalize(path.join(importDir, importPath));
        // console.log("resolvedImport: ", resolvedImport);
        // Process the imported file
        // await processFile(resolvedImport + (resolvedImport.endsWith('.js') ? '' : '.js'), importPath);
        // await processFile(importPath, importPath);
      }
    }

    // Write the processed content to the output directory
    await writeFile(outputPath, content, 'utf8')
    console.log(`Processed: ${filePath}`)
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error)
  }
}

// Process all extensions
async function processExtensions(extensionsJson, sourceDir, outputDir) {
  SOURCE_DIR = sourceDir
  OUTPUT_DIR = outputDir

  console.log(`Processing extensions from ${extensionsJson}`)
  console.log(`Source directory: ${SOURCE_DIR}`)
  console.log(`Output directory: ${OUTPUT_DIR}`)

  try {
    // Read extensions list
    const extensions = JSON.parse(await readFile(extensionsJson, 'utf8'))

    // Process each extension
    for (const ext of extensions) {
      await processExtension(ext)
    }
    console.log('All extensions processed successfully!')
  } catch (error) {
    console.error('Error processing extensions:', error)
    process.exit(1)
  }
}

async function processExtension(ext) {
  console.log(`Processing extension: ${ext}`)

  // Handle extensions with mapping
  if (ext.startsWith('/extensions/')) {
    if (ext.startsWith('/extensions/core/')) {
      // core extensions are not processed
      return
    }
    const pathSegments = ext.split('/').filter((segment) => segment)
    const extensionName = pathSegments[1]

    if (mapping[extensionName]) {
      // Use the mapping to find the correct path
      const filePath = pathSegments.slice(2).join('/')
      const mappedPath =
        SOURCE_DIR + `/custom_nodes/${mapping[extensionName]}/${filePath}`
      const requestedPath = ext
      await processFile(mappedPath, requestedPath)
    } else {
      // Process as is
      throw new Error(`Extension not found: ${extensionName}`)
    }
  } else {
    throw new Error(`Extension in wrong format found: ${ext}`)
  }
}

// Main function
async function main() {
  // Get command line arguments
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.error(
      'Usage: node process-extensions.js <extensions.json> <source-dir> <output-dir>'
    )
    process.exit(1)
  }

  const extensionsJson = args[0]
  const sourceDir = args[1]
  const outputDir = args[2]

  await processExtensions(extensionsJson, sourceDir, outputDir)
}

// Run the script
main()
