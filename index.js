'use strict'

const es = require('elasticsearch')
const validator = require('is-my-json-valid')

// TODO: Change to named schemas and auto-share?
class Schema {
  constructor (properties, opts) {
    this.schema = {
      required: true,
      type: 'object',
      properties
    }

    this.validate = validator(this.schema, opts)
    this.filter = validator.filter(this.schema, opts)
  }
}

class BaseModel {
  constructor (data) {
    const schema = this.constructor.schema
    Object.assign(this, schema.filter(data))

    if (data.id) {
      Object.defineProperty(this, 'id', {
        configurable: true,
        value: data.id
      })
    }
  }

  toJSON () {
    const keys = Object.keys(this)
    const result = {}
    if (this.id) result.id = this.id
    for (let key of keys) {
      result[key] = this[key]
    }
    return result
  }

  get isNew () {
    return !this.id
  }

  validate () {
    const schema = this.constructor.schema
    const valid = schema.validate(this)
    if (!valid) {
      const err = new Error('Validation error')
      err.errors = schema.validate.errors
      throw err
    }
  }

  // Hooks
  async beforeValidate () { }
  async beforeCreate () { }
  async beforeUpdate () { }
  async beforeRemove () { }
  async beforeFetch () { }
  async beforeSave () { }
  async afterValidate () { }
  async afterCreate () { }
  async afterUpdate () { }
  async afterRemove () { }
  async afterFetch () { }
  async afterSave () { }

  async fetch () {
    // Reject removals of unsaved models
    if (this.isNew) {
      throw new Error('cannot fetch unsaved model')
    }
    const { connection, index, type } = this.constructor

    // Run before fetch hook
    await this.beforeFetch()

    // Get remote state and merge into itself
    const response = await connection.get({
      index,
      type,
      id: this.id
    })
    if (!response.found) {
      throw new Error(`Unable to fetch ${this.constructor.name}#${this.id}`)
    }
    Object.assign(this, response._source)

    // Run after fetch hook
    await this.afterFetch()

    return this
  }

  async save () {
    // Use update to sync model state of already persisted records
    if (!this.isNew) {
      return this.update()
    }

    const { connection, schema, index, type } = this.constructor

    // Run the validator, with before and after hooks
    await this.beforeValidate()
    await this.validate()
    await this.afterValidate()

    // Run before create + save hooks
    await this.beforeCreate()
    await this.beforeSave()

    // Insert the document
    const response = await connection.index({
      index,
      type,
      body: schema.filter(this.toJSON()),
      refresh: 'wait_for'
    })

    // Add the id to the model
    Object.defineProperty(this, 'id', {
      configurable: true,
      value: response._id
    })

    // Run after create + save hooks
    await this.afterSave()
    await this.afterCreate()

    return this
  }

  async update (data) {
    // Reject updates on unsaved models
    if (this.isNew) {
      throw new Error('cannot update unsaved model')
    }

    const { connection, schema, index, type } = this.constructor

    // Merge update data into the model, when supplied
    if (data) {
      Object.assign(this, schema.filter(data))
    }

    // Run the validator, with before and after hooks
    await this.beforeValidate()
    await this.validate()
    await this.afterValidate()

    // Run before update + save hooks
    await this.beforeUpdate()
    await this.beforeSave()

    // Update and re-fetch
    await connection.update({
      index,
      type,
      id: this.id,
      body: {
        doc: schema.filter(this.toJSON())
      },
      refresh: 'wait_for'
    })

    // Run after update + save hooks
    await this.afterSave()
    await this.afterUpdate()

    return this
  }

  async remove () {
    // Reject removals of unsaved models
    if (this.isNew) {
      throw new Error('cannot remove unsaved model')
    }

    // Run before remove hook
    await this.beforeRemove()

    // Remove the record from mongo
    const { connection, index, type } = this.constructor
    await connection.delete({
      index,
      type,
      id: this.id,
      refresh: 'wait_for'
    })

    // Delete the id, making it a new model
    Object.defineProperty(this, 'id', {
      configurable: true,
      value: undefined
    })

    // Run after remove hook
    await this.afterRemove()
  }

  static build (data) {
    return new this(data)
  }

  static create (data) {
    return this.build(data).save()
  }

  static async findOrCreate (query, data) {
    const doc = await this.findOne(query)
    if (doc) return doc
    return this.create(data)
  }

  static async findById (id) {
    return this.build({ id }).fetch()
  }

  static async findOne (query) {
    const response = await this.connection.search({
      index: this.index,
      type: this.type,
      body: query,
      size: 1
    })

    const data = response.hits.hits[0]
    if (data) return this.build({
      id: data._id,
      ...data._source
    })
  }

  static async *findIterator (query) {
    let response = await this.connection.search({
      index: this.index,
      type: this.type,
      body: query,
      scroll: '30s'
    })

    let seen = 0

    while (seen < response.hits.total) {
      seen += response.hits.hits.length

      for await (const hit of response.hits.hits) {
        yield this.build({
          id: hit._id,
          ...hit._source
        })
      }

      response = await this.connection.scroll({
        scrollId: response._scroll_id,
        scroll: '30s'
      })
    }
  }

  static async find (query) {
    const items = []
    for await (const item of this.findIterator(query)) {
      items.push(item)
    }
    return items
  }

  static updateById (id, doc) {
    return this.findById(id).update(doc)
  }

  static async *updateIterator (query, data) {
    for await (const item of this.findIterator(query)) {
      yield await item.update(data)
    }
  }

  static async update (query, data) {
    const items = []
    for await (const item of this.updateIterator(query, data)) {
      items.push(item)
    }
    return items
  }

  static async updateById (id, data) {
    const user = await this.findById(id)
    return await user.update(data)
  }

  static async *removeIterator (query) {
    for await (const item of this.findIterator(query)) {
      yield await item.remove(data)
    }
  }

  static async remove (query) {
    for await (const item of this.removeIterator(query)) {}
  }

  static removeById (id) {
    return this.build({ id }).remove()
  }

  static async count (body) {
    const { count } = await this.connection.count({
      index: this.index,
      type: this.type,
      body
    })

    return count
  }
}

class ElasticModeller extends Map {
  constructor (opt = {}) {
    super()
    this.connection = es.Client({
      host: 'localhost:9200',
      ...opt
    })
  }

  createModel (index, type, schema, opts) {
    if (typeof type !== 'string') {
      opts = schema
      schema = type
      type = '_doc'
    }

    if (!(schema instanceof Schema)) {
      schema = new Schema(schema, opts)
    }

    class Model extends BaseModel {}
    define(Model, 'connection', this.connection)
    define(Model, 'schema', schema)
    define(Model, 'index', index)
    define(Model, 'type', type)

    this.set(`${index}.${type}`, Model)

    return Model
  }

  get (...args) {
    return super.get(args.join('.'))
  }

  ping (requestTimeout = 1000) {
    return this.connection.ping({
      requestTimeout
    })
  }
}

function define (obj, prop, value) {
  Object.defineProperty(obj, prop, { value })
}

function buildModeller (opt) {
  return new ElasticModeller(opt)
}

buildModeller.Schema = Schema
buildModeller.BaseModel = BaseModel
buildModeller.ElasticModeller = ElasticModeller

module.exports = buildModeller
