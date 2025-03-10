/* global process */
import { config } from 'dotenv'
import { copy, pathExists, remove } from 'fs-extra'

config()

const distDir = './dist'
// const customNodesDir = './custom_nodes'
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
    await copy(distDir, targetDir + '/web')
    console.log(`Directory copied successfully! ${distDir} -> ${targetDir}`)
    // await copy(customNodesDir, targetDir + '/custom_nodes')
    // console.log(`Directory copied successfully! ${customNodesDir} -> ${targetDir}`)
  } catch (err) {
    console.error('Error during deployment:', err)
    process.exit(1)
  }
}

deploy()
