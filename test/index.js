"use strict";

var connect = require("../browser/http")
var reduce = require("reducers/reduce")
var test = require("reducers/test/util/test")
var map = require("reducers/map")

function url(path) {
  return "http://localhost:8082/" + path
}

module.exports = {
  "test get": function(assert, done) {
    var body = connect.read(url("get"))
    var result = reduce(body, function(result, data) {
      assert.equal(data, "boop", "expected data returned")

      return result + data
    }, "")

    reduce(result, function(_, value) {
      assert.equal(value, "boop", "data accumulated")
      done()
    })
  },
  "test head": test(function(assert) {
    var head = connect.head({
      uri: url("head"),
      headers: {
        "bling": "blong"
      }
    })

    var actual = map(head, function(data) {
      return {
        statusCode: data.statusCode,
        headers: {
          bling: data.headers.bling,
          foo: data.headers.foo
        }
      }
    })

    assert(actual, [{
      statusCode: 200,
      headers: {
        bling: "blong-blong",
        foo: "bar",
      }
    }], "head is read")
  }),
  "test post": test(function(assert) {
    var n = 100
    var body = connect.read({
      uri: url("post"),
      method: "post",
      body: n
    })

    assert(body, ["101"], "data has being posted and received")
  }),
  "test streaming": test(function(assert) {
    var body = connect.read(url("stream"))
    var actual = map(body, JSON.parse)

    assert(actual, [
      { index: 1, data: "hello" },
      { index: 2, data: "world" },
      { index: 3, data: "bye" }
    ], "JSON data has being delivered")
  }),
  "test exit": test(function(assert) {
    var body = connect.read("http://localhost:8082/exit")
    assert(body, ["bye bye"], "finished")
  })
}

require("test").run(module.exports)
