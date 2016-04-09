'use strict'
const util = require('util')
const EventEmitter = require('events')
const Ssh2Client = require('ssh2').Client

function MyEmitter () {
  EventEmitter.call(this)
}
util.inherits(MyEmitter, EventEmitter)

function nextConfig (dest) {
  let next = dest.shift()

  // add $USER if necessary
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

  if (dest[0]) {
    // there is at last one more destination
    // therefore our next must be a hop
    let p = dest[0].split(/@|:/)
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

  process.nextTick(nextConnection)

  return emitter

  function nextConnection (stream) {
    const conn = new Ssh2Client()
    if (!firstConnection) {
      firstConnection = conn
    }

    const cfg = nextConfig(dest)
    if (!(cfg.username && cfg.host && cfg.port)) {
      return emitter.emit('error', 'invalid destination')
    }

    if (cfg.cmd) {
      //
      // hop
      //
      emitter.emit('info', 'ssh next hop:\n' + util.inspect(cfg, {colors: true}))

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

      conn.on('error', function (err) {
        emitter.emit('error', err)
        firstConnection.end()
      })

      conn.connect(cfg)
    } else {
      //
      // final destination
      //
      emitter.emit('info', 'ssh final:\n' + util.inspect(cfg, {colors: true}))

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

      conn.on('error', function (err) {
        emitter.emit('error', err)
        firstConnection.end()
      })

      conn.connect(cfg)
    }
  }
}

