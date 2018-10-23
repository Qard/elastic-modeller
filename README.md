# elastic-modeller

The `elastic-modeller` module provides a simple document modelling interface for Elasticsearch.

## Install

```sh
npm install elastic-modeller
```

## Usage

```js
const modeller = require('elastic-modeller')()

async function main() {
  const User = modeller.createModel('user', {
    email: {
      required: true,
      type: 'string'
    },
    hash: {
      required: true,
      type: 'string'
    },
    createdAt: 'string',
    updatedAt: 'string'
  })

  User.prototype.beforeCreate = function () {
    this.createdAt = new Date().toISOString()
  }

  User.prototype.beforeUpdate = function () {
    this.updatedAt = new Date().toISOString()
  }

  User.register = function register({ email, password }) {
    return User.create({ email, hash: hash(password) })
  }

  User.login = async function login({ email, password }) {
    const user = await User.findOne({
      query: {
        match_phrase: {
          email
        }
      }
    })

    if (!user || !compareHash(user.hash, password)) {
      throw new Error('Unable to login')
    }

    return user
  }

  const user = await User.register({
    email: 'me@example.com',
    password: 'some password'
  })

  const user2 = await User.login({
    email: 'me@example.com',
    password: 'some password'
  })
}
```

## Root API

### Methods

#### ElasticModeller.createModel(index: String[, type: String], schema: Object, opts: Object): Model
Build a model class for a given index, and optional type, defined by a json schema.

#### ElasticModeller.get(index: String[, type: String]): Model
Find an existing model by index and type.

#### ElasticModeller.ping(requestTimeout: Number = 1000): Boolean
Do a ping check the verify the server is available.

## Model API

### Statics

#### Model.build(data: Object): model
Build a model instance.

#### Model.create(data: Object): Promise(model)
Build and save a model instance.

#### Model.find(query: Object): Promise(Array(model))
Find an array of model instances matching the given query.

#### Model.findIterator(query: Object): AsyncGenerator(model)
Create an async iterator of model instances matching the given query.

#### Model.findOne(query: Object): Promise(model)
Find one model instance matching the given query.

#### Model.findById(id: String): Promise(model)
Find one model instance by id.

#### Model.findOrCreate(query: Object, data: Object): Promise(model)
Find or create a model instance given a query and a set of data.

#### Model.updateIterator(query: Object, data: Object): AsyncGenerator(model)
Update any records that match the query using the given data.

#### Model.update(query: Object, data: Object): Promise(Array(model))
Update any records that match the query using the given data.

#### Model.updateById(id: String, data: Object): Promise(model)
Update a record by id with the given data.

#### Model.removeIterator(query: Object): AsyncGenerator(null)
Remove any records that match the query.

#### Model.remove(query: Object): Promise(null)
Remove any records that match the query.

#### Model.removeById(id: String): Promise(null)
Remove a record by id.

#### Model.count(query: Object): Promise(Number)
Count the number of records matching the query.

### Methods

#### model.isNew: Boolean
This getter is mostly used internally to detect if a model exists in Elasticsearch. It simply checks for existence of an `id` property.

#### model.save(): Promise(model)
Insert or update the model data to elasticsearch.

#### model.update(data: Object): Promise(model)
Update the model data and save the changes.

#### model.remove(): Promise(null)
Remove the model from elasticsearch.

#### model.fetch(): Promise(model)
Fetch the latest model state from elasticsearch.

#### model.toJSON(): Object
Build a simple JavaScript object from the model contents for use with `JSON.stringify(...)`.

### Hook methods

There are several hook methods that can be overridden to trigger things before or after various interactions. Each can be an async function or return a promise to do asynchronous things on the model before proceeding. These methods include:

- `beforeSave`
- `beforeCreate`
- `beforeUpdate`
- `beforeRemove`
- `beforeValidate`
- `afterSave`
- `afterCreate`
- `afterUpdate`
- `afterRemove`
- `afterValidate`

---

### Copyright (c) 2018 Stephen Belanger
#### Licensed under MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
