"use strict";

var XHR = require("./xhr")

var url = require("url")

var reducible = require("reducible/reducible")
var isReduced = require("reducible/is-reduced")
var end = require("reducible/end")

var take = require("reducers/take")
var drop = require("reducers/drop")
var map = require("reducers/map")

var method = require("method")

var connect = method("connect")

var keys = Object.keys
var isArray = Array.isArray

// Based of https://mxr.mozilla.org/mozilla-central/source/content/base/src/nsXMLHttpRequest.cpp#3221
var unsupportedHeaders = [
  "accept-charset", "accept-encoding", "access-control-request-headers",
  "access-control-request-method", "connection", "content-length",
  "cookie", "cookie2", "content-transfer-encoding", "date", "expect",
  "host", "keep-alive", "origin", "referer", "te", "trailer",
  "transfer-encoding",  "upgrade", "user-agent", "via"
]

function isHeaderSupported(name) {
  return unsupportedHeaders.indexOf(name) === -1
}

function setHeaders(xhr, headers) {
  keys(headers).forEach(function (name) {
    if (isHeaderSupported(name)) {
      var value = headers[name]
        if (isArray(value))
          value.forEach(function(value) { xhr.setRequestHeader(name, value) })
        else
          xhr.setRequestHeader(name, value)
    }
  })
}

function incorporateHeader(headers, source) {
  if (source !== "") {
    var m = source.match(/^([^:]+):\s*(.*)/)
    if (m) {
      var name = m[1].toLowerCase()
      var value = m[2]
      if (headers[name] !== undefined) {
        if (isArray(headers[name])) headers[name].push(value)
        else headers[name] = [ headers[name], value ]
      } else {
        headers[name] = value
      }
    } else {
      headers[source] = true
    }
  }
  return headers
}

function parseHeaders(xhr) {
  try {
    var lines = xhr.getAllResponseHeaders().split(/\r?\n/)
    return lines.reduce(incorporateHeader, {})
  } catch(e) {
    return null
  }
}

var isStatus2Supported = true
var isStreamingSupported = true

function readChunk(xhr, position) {
  try { return xhr.responseText.substr(position) } catch(e) { return null }
}

function Request(options) {
  this.method = options.method ? options.method.toUpperCase() : "GET"
  this.headers = options.headers || null
  this.protocol = options.protocol || "http:"
  this.host = options.host
  this.hostname = options.hostname
  this.port = options.port || null
  this.pathname = options.pathname || "/"
  this.hash = options.hash || ""
  this.query = options.query || ""
  this.body = options.body || ""
  this.type = options.type || null
  this.mimeType = options.mimeType || null
  this.credentials = options.credentials || null
  this.timeout = options.timeout || null
  this.uri = options.uri || url.format(this)
}
connect.define(Request, function(request) {
  var uri = request.uri
  var method = request.method
  var type = request.type
  var headers = request.headers
  var mimeType = request.mimeType
  var credentials = request.credentials
  var timeout = request.timeout
  var body = request.body

  return reducible(function(next, state) {
    var xhr = new XHR()
    if (credentials)
      xhr.open(method, uri, true, credentials.user, credentials.password)
    else
      xhr.open(request.method, request.uri, true)

    if (type) xhr.responseType = type
    if (headers) setHeaders(xhr, headers)
    if (mimeType) xhr.overrideMimeType(mimeType)
    if (credentials) xhr.withCredentials = true
    if (timeout) xhr.timeout = timeout

    var position = 0
    var responseHeaders = null
    var responseStatusCode = null
    var chunk = null

    xhr.onreadystatechange = function readyStateHandler(event) {
      if (!responseHeaders && (responseHeaders = parseHeaders(xhr))) {
        state = next({
          headers: responseHeaders,
          statusCode: xhr.status
        }, state)
      } else if ((chunk = readChunk(xhr, position))) {
        position = position + chunk.length
        state = next(chunk, state)
      }

      if (xhr.readyState === 4) {
        xhr.onreadystatechange = null
        if (xhr.error) next(xhr.error, state)
        else next(end, state)
      } else if (isReduced(state)) {
        xhr.onreadystatechange = null
        xhr.abort()
        next(end, state.value)
      }
    }

    xhr.send(body)
  })
})

function request(options) {
  return typeof(options) === "string" ? new Request({ uri: options }) :
         new Request(options)
}

connect.define(String, function(uri) { return connect(request({ uri: uri })) })
connect.request = request
connect.head = function head(options) {
  /**
  Read the head data for a single request.
  Returns a reducible.
  **/
  return take(connect(request(options)), 1)
}
connect.headers = function headers(request) {
  /**
  Read the headers for a single request.
  Returns a reducible.
  **/
  return map(connect.head(request), function(head) { return head.headers })
}
connect.body = function read(options) {
  /**
  Read the request body for a single request.
  Returns a reducible.

  Example:

      var body = http.read("http://example.com");
      reduce(body, writeBodyToDOM);

  **/
  return drop(connect(request(options)), 1)
}
connect.read = connect.body


module.exports = connect

/**
## Usage

var content = http.content("http://localhost:8080/")

reduce(content, function(_, data) {
  console.log(data)
}, 0)
**/
