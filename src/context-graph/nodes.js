const crypto = require('node:crypto')
const path = require('node:path')

const normalizeRelativePath = (relativePath) => (
  relativePath ? relativePath.split(path.sep).join('/') : ''
)

const createNodeId = ({ relativePath, type }) => {
  const normalized = normalizeRelativePath(relativePath)
  const hash = crypto.createHash('sha1').update(`${type}:${normalized}`).digest('hex').slice(0, 12)
  return `n_${hash}`
}

class Node {
  constructor ({ id, type, name, relativePath, summary = '', summaryUpdatedAt = null }) {
    this.id = id
    this.type = type
    this.name = name
    this.relativePath = relativePath
    this.summary = summary
    this.summaryUpdatedAt = summaryUpdatedAt
  }

  toJSON () {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      relativePath: this.relativePath,
      summary: this.summary,
      summaryUpdatedAt: this.summaryUpdatedAt
    }
  }
}

class FileNode extends Node {
  constructor ({ id, name, relativePath, sizeBytes, modifiedAt, contentHash, summary = '', summaryUpdatedAt = null }) {
    super({ id, type: 'file', name, relativePath, summary, summaryUpdatedAt })
    this.sizeBytes = sizeBytes
    this.modifiedAt = modifiedAt
    this.contentHash = contentHash
  }

  toJSON () {
    return {
      ...super.toJSON(),
      sizeBytes: this.sizeBytes,
      modifiedAt: this.modifiedAt,
      contentHash: this.contentHash
    }
  }
}

class FolderNode extends Node {
  constructor ({ id, name, relativePath, children = [], contentHash = null, summary = '', summaryUpdatedAt = null }) {
    super({ id, type: 'folder', name, relativePath, summary, summaryUpdatedAt })
    this.children = children
    this.contentHash = contentHash
  }

  toJSON () {
    return {
      ...super.toJSON(),
      children: this.children,
      contentHash: this.contentHash
    }
  }
}

module.exports = {
  Node,
  FileNode,
  FolderNode,
  createNodeId,
  normalizeRelativePath
}
