const fs = require('node:fs')
const path = require('node:path')
const { resolveSettingsDir } = require('../settings')

const { CONTEXT_GRAPH_FILE_NAME, JIMINY_BEHIND_THE_SCENES_DIR_NAME } = require('../const')

class ContextGraphStore {
  load () {
    throw new Error('ContextGraphStore.load not implemented')
  }

  save (_graph) {
    throw new Error('ContextGraphStore.save not implemented')
  }

  delete () {
    throw new Error('ContextGraphStore.delete not implemented')
  }

  getPath () {
    throw new Error('ContextGraphStore.getPath not implemented')
  }
}

class JsonContextGraphStore extends ContextGraphStore {
  constructor (options = {}) {
    super()
    this.contextFolderPath = typeof options.contextFolderPath === 'string' ? options.contextFolderPath : ''
    this.settingsDir = resolveSettingsDir(options.settingsDir)
    this.graphPath = this.contextFolderPath
      ? path.join(this.contextFolderPath, JIMINY_BEHIND_THE_SCENES_DIR_NAME, CONTEXT_GRAPH_FILE_NAME)
      : null
  }

  getPath () {
    return this.graphPath
  }

  load () {
    if (!this.graphPath || !fs.existsSync(this.graphPath)) {
      return null
    }

    const raw = fs.readFileSync(this.graphPath, 'utf-8')
    if (!raw.trim()) {
      return null
    }

    try {
      return JSON.parse(raw)
    } catch (error) {
      console.error('Failed to parse context graph', error)
      return null
    }
  }

  save (graph) {
    if (!this.graphPath) {
      throw new Error('Context folder path is required to save context graph.')
    }
    fs.mkdirSync(path.dirname(this.graphPath), { recursive: true })
    fs.writeFileSync(this.graphPath, JSON.stringify(graph, null, 2), 'utf-8')
    return this.graphPath
  }

  delete () {
    if (!this.graphPath || !fs.existsSync(this.graphPath)) {
      return { deleted: false }
    }

    fs.unlinkSync(this.graphPath)
    return { deleted: true }
  }
}

module.exports = {
  ContextGraphStore,
  JsonContextGraphStore,
  CONTEXT_GRAPH_FILE_NAME
}
