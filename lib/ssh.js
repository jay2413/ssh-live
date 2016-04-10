'use strict'
const util = require('util')
const EventEmitter = require('events')
const Ssh2Client = require('ssh2').Client

function MyEmitter () {
  EventEmitter.call(this)
}
util.inherits(MyEmitter, EventEmitter)

function nextConfig (dest) {
  let next = dest[0]

  if (!/@/.test(next)) {
    next = process.env.USER + '@' + next
  }

  let p = next.split(/@|:/)

  let cfg = {
    username: p[0],
    host: p[1],
    port: parseInt(p[2]) || 22,
    agent: process.env.SSH_AUTH_SOCK,
    keepaliveInterval: 60000,
    agentForward: true
  }

  // there is at last one more destination
  // next must be a hop
  if (dest[1]) {
    let p = dest[1].split(/@|:/)
    cfg.cmd = util.format('nc %s %d', p[1], p[2] || 22)
  }

  return cfg
}

/*
 * @param {Array} arg
 *  list of targets (user@host:port)
 */
module.exports = function (arg) {
  const emitter = new MyEmitter()
  let dest = arg.slice()
  let firstConnection

  function nextConnection (stream) {
    const cfg = nextConfig(dest)
    dest.shift(1)
    if (!(cfg.username && cfg.host && cfg.port)) {
      return emitter.emit('error', 'invalid destination')
    }
    emitter.emit('info', util.inspect(cfg, {colors: true}))

    const conn = new Ssh2Client()
    if (cfg.cmd) {
      // hop
      conn.on('ready', function () {
        conn.exec(cfg.cmd, function (err, stream) {
          if (err) {
            emitter.emit('error', err)
            firstConnection.end()
            return
          }
          nextConnection(stream)
        })
      })
    } else {
      // final destination
      cfg.sock = stream

      conn.on('ready', function () {
        conn.shell({term: 'xterm-color'}, function (err, stream) {
          if (err) {
            return emitter.emit('error', err)
          }
          process.stdin.setRawMode(true)
          process.stdin.pipe(stream)
          stream.pipe(process.stdout)

          stream.stderr.pipe(process.stderr)

          stream.on('data', function (data) {
            emitter.emit('data', data.toString())
          })
          stream.on('end', function () {
            process.stdin.setRawMode(false)
            firstConnection.end()
            emitter.emit('end')
          })
        })
      })
    }

    conn.on('error', function (err) {
      emitter.emit('error', err)
      firstConnection.end()
    })

    if (!firstConnection) {
      firstConnection = conn
    }
    conn.connect(cfg)
  }

  process.nextTick(nextConnection)
  return emitter
}

