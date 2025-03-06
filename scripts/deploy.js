/* global process */
import { config } from 'dotenv'
import { copy, pathExists, remove } from 'fs-extra'

config()

const sourceDir = './dist'
const targetDir = process.env.DEPLOY_COMFYUI_DIR

async function deploy() {
  try {
    // Check if target directory exists and remove it
    const exists = await pathExists(targetDir)
    if (exists) {
      await remove(targetDir)
      console.log(`Cleaned existing directory: ${targetDir}`)
    }

    // Copy new files
    await copy(sourceDir, targetDir)
    console.log(`Directory copied successfully! ${sourceDir} -> ${targetDir}`)
  } catch (err) {
    console.error('Error during deployment:', err)
    process.exit(1)
  }
}

deploy()
