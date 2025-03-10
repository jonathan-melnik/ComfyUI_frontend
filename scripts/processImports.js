import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

// Convert fs promises to use ES modules
const readFile = fs.promises.readFile
const writeFile = fs.promises.writeFile
const mkdir = fs.promises.mkdir
const copyFile = fs.promises.copyFile
const readdir = fs.promises.readdir
const access = fs.promises.access

let rootDir = ''

const mapping = {
  'cg-use-everywhere': 'cg-use-everywhere/js',
  'ComfyUI-Impact-Pack': 'comfyui-impact-pack/js',
  ComfyUI_essentials: 'ComfyUI_essentials/js',
  'efficiency-nodes-comfyui': 'efficiency-nodes-comfyui/js',
  'times-two': 'times-two/web/js',
  'rgthree-comfy': 'rgthree-comfy/web/comfyui'
}

function isFileICare(filePath) {
  const filesICare = ['progress_bar', 'base_node_mode_changer', 'comfyui_shim']
  return filesICare.some((file) => filePath.includes(file))
}

// Rewrite imports in JavaScript content
function rewriteImports(content, filePath) {
  if (isFileICare(filePath)) {
    console.log('\x1b[33m!!', filePath, '\x1b[0m')
  }
  filePath = filePath.replace(rootDir, '') // remove rootDir from filePath

  // Normalize filePath to use forward slashes
  filePath = filePath.replace(/\\/g, '/')

  if (isFileICare(filePath)) {
    console.log('- No root:', filePath)
  }

  // First, use the mapping in inverse direction to replace the extension name with the new one
  // Because with the new mapping, the relative paths will be correct
  for (const [key, value] of Object.entries(mapping)) {
    if (filePath.includes(value)) {
      filePath = filePath.replace(value, key)

      if (isFileICare(filePath)) {
        console.log('- Replaced mapping:', filePath)
      }
      break
    }
  }

  if (
    filePath.startsWith('/custom_nodes/rgthree-comfy/web/common') ||
    filePath.startsWith('/custom_nodes/rgthree-comfy/web/link_fixer')
  ) {
    const before = filePath
    filePath = filePath.replace('/custom_nodes/rgthree-comfy/web/', '/rgthree/')
    console.log(
      '-(common or link_fixer) replacing in',
      before,
      'with',
      filePath
    )
  }

  const importDir = path.dirname(filePath)
  if (isFileICare(filePath)) {
    console.log('- importDir', importDir)
  }

  // Then, rewrite the imports
  return content.replace(
    /(import\s+(?:(?:\{[^}]*\}|\*\s+as\s+[^,\s]+|\w+)\s*,?\s*)*from\s+['"])(\.[^'"]+)(['"])/g,
    (match, importStart, importPath, importEnd) => {
      // Convert relative path to absolute path based on the file's directory
      let absoluteImportPath = path
        .normalize(path.join(importDir, importPath))
        .replace(/\\/g, '/') // Replace all backslashes with forward slashes

      if (isFileICare(filePath)) {
        console.log('\x1b[32m', importPath, '\x1b[0m')
        console.log('- absoluteImportPath', absoluteImportPath)
      }

      if (absoluteImportPath.includes('/rgthree/')) {
        absoluteImportPath = parseRgthreeRoute(absoluteImportPath)
      } else if (absoluteImportPath.startsWith('/custom_nodes/core')) {
        absoluteImportPath = absoluteImportPath.replace(
          '/custom_nodes/core',
          '/extensions/core'
        )
      } else {
        // Now, we need to use the mapping in forward direction to replace the extension name with the new one
        for (const [key, value] of Object.entries(mapping)) {
          if (absoluteImportPath.includes(key)) {
            absoluteImportPath = absoluteImportPath.replace(key, value)
          }
        }
      }

      if (isFileICare(filePath)) {
        console.log('- mapped absoluteImportPath', absoluteImportPath)
      }

      // Make sure the path starts with a single slash
      let formattedPath = absoluteImportPath
      if (
        !absoluteImportPath.startsWith('/') &&
        !absoluteImportPath.startsWith('http')
      ) {
        formattedPath = '/' + absoluteImportPath
      }

      return `${importStart}${formattedPath}${importEnd}`
    }
  )
}

function parseRgthreeRoute(importPath) {
  if (importPath == '/rgthree/config.js') {
    return process.env.VITE_API_URL + '/rgthree/config.js'
  }

  const pathPart = importPath.split('/')[2]
  const segments = importPath.split('/').slice(3, -1)
  const subdir = segments.length ? segments.join('/') + '/' : ''
  const file = importPath.split('/').pop()
  return `/custom_nodes/rgthree-comfy/web/${pathPart}/${subdir}${file}`

  // if (importPath.includes('/rgthree/common')) {
  //     return importPath.replace('/rgthree/common', '/rgthree-comfy/web/common',)
  // } else if (importPath.includes('/rgthree/link_fixer')) {
  //     return importPath.replace('/rgthree/link_fixer', '/rgthree-comfy/web/link_fixer')
  // } else {
  //     const pathPart = importPath.split("/")[2];
  //     const segments = importPath.split("/").slice(3, -1);
  //     const subdir = segments.length ? segments.join("/") + "/" : "";
  //     const file = importPath.split("/").pop();
  //     return `/custom_nodes/rgthree-comfy/web/${pathPart}/${subdir}${file}`;
  // }
}

// Function to ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

// Function to process a single file
async function processFile(inputPath, outputPath) {
  try {
    const content = await readFile(inputPath, 'utf-8')

    // Ensure the output directory exists
    await ensureDirectoryExists(path.dirname(outputPath))

    if (path.extname(inputPath) === '.js') {
      // console.log(`Processing JavaScript file: ${inputPath}`);
      const processedContent = rewriteImports(content, inputPath)
      await writeFile(outputPath, processedContent, 'utf-8')
    } else {
      // console.log(`Copying non-JavaScript file: ${inputPath}`);
      await copyFile(inputPath, outputPath)
    }
  } catch (error) {
    console.error(`Error processing file ${inputPath}:`, error)
  }
}

// Function to recursively process all files in a directory
async function processDirectory(inputDir, outputDir) {
  try {
    const entries = await readdir(inputDir, { withFileTypes: true })

    for (const entry of entries) {
      const inputPath = path.join(inputDir, entry.name)
      const relativePath = path.relative(inputDir, inputPath)
      const outputPath = path.join(outputDir, relativePath)

      if (entry.isDirectory()) {
        await ensureDirectoryExists(outputPath)
        await processDirectory(inputPath, outputPath)
      } else {
        await processFile(inputPath, outputPath)
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${inputDir}:`, error)
  }
}

// Main function
async function main() {
  const inputDir = process.argv[2]
  const outputDir = process.argv[3]

  if (!inputDir || !outputDir) {
    console.error(
      'Please provide both input and output directories as arguments'
    )
    console.error(
      'Usage: node processImports.js <input-directory> <output-directory>'
    )
    process.exit(1)
  }

  try {
    const absoluteRootDirPath = path.resolve(rootDir)
    const customNodesAbsolutePath = path.join(
      absoluteRootDirPath,
      'custom_nodes'
    )

    // Check if input directory exists
    try {
      await access(absoluteRootDirPath)
    } catch (error) {
      console.error(`Input directory does not exist: ${absoluteRootDirPath}`)
      process.exit(1)
    }
    // Check if custom_nodes directory exists
    try {
      await access(customNodesAbsolutePath)
    } catch (error) {
      console.error(
        `Custom nodes directory does not exist: ${customNodesAbsolutePath}`
      )
      process.exit(1)
    }

    const absoluteOutputPath = path.resolve(outputDir)

    console.log(`Processing files from: ${customNodesAbsolutePath}`)
    console.log(`Saving results to: ${absoluteOutputPath}`)

    rootDir = absoluteRootDirPath

    await ensureDirectoryExists(absoluteOutputPath)
    await processDirectory(customNodesAbsolutePath, absoluteOutputPath)

    console.log('Processing completed successfully')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Run the script
main()
