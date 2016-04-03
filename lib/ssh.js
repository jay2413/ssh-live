'use strict'
const util = require('util')
const Client = require('ssh2').Client
const EventEmitter = require('events').EventEmitter

/*
 * @param {Array} arg
 *  list of targets (user@host:port)
 */
module.exports = function (arg) {
  let emitter = new EventEmitter()
  let dest = arg.slice()
  let first

  process.nextTick(nextConnection)

  return emitter

  function getConfig () {
    let curr = dest.shift()

    // add $USER if necessary
    if (!/@/.test(curr)) {
      curr = process.env.USER + '@' + curr
    }

    let p = curr.split(/@|:/)

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
      // therefore this must be a hop
      let p = dest[0].split(/@|:/)
      cfg.cmd = util.format('nc %s %d', p[1], p[2] || 22)
    }

    return cfg
  }

  function nextConnection (stream) {
    let client = new Client()
    if (!first) {
      first = client
    }

    let cfg = getConfig()
    if (!(cfg.username && cfg.host && cfg.port)) {
      return emitter.emit('error', 'invalid destination')
    }

    if (cfg.cmd) {
      //
      // hop
      //
      emitter.emit('info', 'ssh next hop:\n' + util.inspect(cfg, {colors: true}))

      client.on('ready', function () {
        client.exec(cfg.cmd, function (err, stream) {
          if (err) {
            emitter.emit('error', err)
            first.end()
            return
          }
          nextConnection(stream)
        })
      })

      client.on('error', function (err) {
        emitter.emit('error', err)
        first.end()
      })

      client.connect(cfg)
    } else {
      //
      // final destination
      //
      emitter.emit('info', 'ssh final:\n' + util.inspect(cfg, {colors: true}))

      cfg.sock = stream

      client.on('ready', function () {
        client.shell({term: 'xterm-color'}, function (err, stream) {
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
            first.end()
            process.stdin.end()
            emitter.emit('end')
          })
        })
      })

      client.on('error', function (err) {
        emitter.emit('error', err)
        first.end()
      })

      client.connect(cfg)
    }
  }
}

