'use strict'

const tap = require('tap')
const es = require('./')()

const index = 'index'
const schema = {
  test: {
    required: true,
    type: 'string'
  },
  foo: 'string',
  createdAt: 'string',
  updatedAt: 'string'
}

tap.test('ping', async () => {
  await es.ping()
})

let Model
tap.test('createModel', async t => {
  Model = es.createModel(index, schema)
  t.deepEqual(Model.schema.schema.properties, schema)
  t.equal(Model.index, index)
  t.equal(Model.type, '_doc')

  Model.prototype.beforeCreate = function () {
    this.createdAt = new Date().toISOString()
  }

  Model.prototype.beforeUpdate = function () {
    this.updatedAt = new Date().toISOString()
  }
})

tap.test('get', async t => {
  t.equal(es.get(index, '_doc'), Model)
})

tap.test('build static', async t => {
  const instance = new Model({
    test: 'build static'
  })
  t.equal(instance.test, 'build static')
  t.ok(instance.isNew)
})

tap.test('create static and remove method', async t => {
  const instance = await Model.create({
    test: 'create static and remove method'
  })

  t.notOk(instance.isNew)

  await instance.remove()

  t.equal(instance.test, 'create static and remove method')
  t.ok(instance.isNew)
})

tap.test('toJSON method', async t => {
  const instance = new Model({
    test: 'toJSON'
  })

  t.deepEqual(instance.toJSON(), {
    test: 'toJSON'
  })
})

tap.test('validate method', async t => {
  const instance = new Model({
    nope: 'fail'
  })

  let error
  try {
    instance.validate()
  } catch (err) {
    error = err
  }

  t.ok(error)
  t.equal(error.message, 'Validation error')
  t.equal(error.errors.length, 1)
  t.deepEqual(error.errors[0], {
    field: 'data.test',
    message: 'is required'
  })
})

tap.test('save method', async t => {
  const instance = new Model({
    test: 'save'
  })

  t.ok(instance.isNew)

  await instance.save()

  t.notOk(instance.isNew)

  await instance.remove()

  t.ok(instance.isNew)
})

tap.test('update method', async t => {
  const instance = await Model.create({
    test: 'update'
  })

  const updatedAt = instance.updatedAt

  await instance.update({
    test: 'update!'
  })

  t.notEqual(instance.updatedAt, updatedAt)

  await instance.remove()
})

tap.test('update static', async t => {
  const a = await Model.create({
    test: 'update static'
  })

  const it = await Model.update({
    query: {
      match_phrase: {
        test: a.test
      }
    }
  }, {
    test: 'update static!'
  })

  const first = await it.next()
  t.notEqual(first.value.updatedAt, a.updatedAt)
  t.notOk(first.done)

  const second = await it.next()
  t.notOk(second.value)
  t.ok(second.done)

  await a.remove()
})

tap.test('updateById static', async t => {
  const a = await Model.create({
    test: 'updateById static'
  })

  await Model.updateById(a.id, {
    test: 'updateById static!'
  })

  const b = await Model.findOne({
    query: {
      match_phrase: {
        test: 'updateById static!'
      }
    }
  })

  t.notEqual(b.updatedAt, a.updatedAt)

  await a.remove()
})

tap.test('fetch method', async t => {
  const instance = await Model.create({
    test: 'fetch method'
  })

  const found = new Model({
    id: instance.id
  })

  await found.fetch()

  t.deepEqual(found.toJSON(), instance.toJSON())

  await instance.remove()
})

tap.test('findById static', async t => {
  const instance = await Model.create({
    test: 'findById static'
  })

  const found = await Model.findById(instance.id)

  t.deepEqual(found.toJSON(), instance.toJSON())

  await instance.remove()
})

tap.test('findOne static', async t => {
  const instance = await Model.create({
    test: 'findOne static'
  })

  const found = await Model.findOne({
    query: {
      match_phrase: {
        test: instance.test
      }
    }
  })

  t.ok(found)
  t.deepEqual(found.toJSON(), instance.toJSON())

  await instance.remove()
})

tap.test('find static', async t => {
  const instance = await Model.create({
    test: 'find static'
  })

  const items = await Model.find({
    query: {
      match_phrase: {
        test: instance.test
      }
    }
  })

  t.equal(items.length, 1)
  t.deepEqual(items[0].toJSON(), instance.toJSON())

  await instance.remove()
})

tap.test('findIterator static', async t => {
  const instance = await Model.create({
    test: 'find static'
  })

  const it = Model.findIterator({
    query: {
      match_phrase: {
        test: instance.test
      }
    }
  })

  const first = await it.next()
  t.deepEqual(first.value.toJSON(), instance.toJSON())
  t.notOk(first.done)

  const second = await it.next()
  t.notOk(second.value)
  t.ok(second.done)

  await instance.remove()
})

tap.test('findOrCreate static', async t => {
  const a = await Model.findOrCreate({
    query: {
      match_phrase: {
        test: 'findOrCreate static'
      }
    }
  }, {
    test: 'findOrCreate static'
  })

  const b = await Model.findOrCreate({
    query: {
      match_phrase: {
        test: 'findOrCreate static'
      }
    }
  }, {
    test: 'findOrCreate static'
  })

  const items = await Model.find({
    query: {
      match_phrase: {
        test: a.test
      }
    }
  })

  t.equal(items.length, 1)
  t.deepEqual(items[0].toJSON(), a.toJSON())
  t.deepEqual(items[0].toJSON(), b.toJSON())

  await a.remove()
})

tap.test('remove static', async t => {
  const instance = await Model.create({
    test: 'remove static'
  })

  await Model.remove({
    test: instance.test
  })
})

tap.test('removeById static', async t => {
  const instance = await Model.create({
    test: 'removeById static'
  })

  await Model.removeById(instance.id)
})

tap.test('count static', async t => {
  const instance = await Model.create({
    test: 'count'
  })

  const count = await Model.count({
    query: {
      match_phrase: {
        test: 'count'
      }
    }
  })

  t.equal(count, 1)

  await instance.remove()
})
