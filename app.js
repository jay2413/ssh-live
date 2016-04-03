'use strict'
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const util = require('util')
//
const WSserver = require('ws').Server
const cmd = require('commander')
const compression = require('compression')
const express = require('express')
const helmet = require('helmet')
const morgan = require('morgan')
//
const ssh = require('./lib/ssh')

const defaults = {
  title: 'ssh-live',
  port: 5656,
  logfile: path.join(os.tmpdir(), 'ssh-live.log')
}

//
// parse command line
//
cmd
  .usage('[options] [hop...] user@hostname[:port]')
  .option('-l, --logfile <filename>', 'logfile - defaults to ' + defaults.logfile, defaults.logfile)
  .option('-p, --port <port>', 'http listen port - defaults to ' + defaults.port, defaults.port, parseInt)
  .on('--help', function () {
    console.log('  Example:')
    console.log('    ssh-live foo@bar')
    console.log()
    console.log('  Example using multiple hops:')
    console.log('    ssh-live -p 8080 user1@hop1:2233 user2@hop2 user3@final-server')
    console.log()
  })
  .parse(process.argv)

if (cmd.args.length < 1) {
  cmd.help()
}

if (cmd.port < 1024 && process.geteuid() !== 0) {
  console.error('  Error: listen port < 1024, must run as root')
  cmd.help()
}

//
// app
//
process.title = defaults.title
const logStream = fs.createWriteStream(cmd.logfile, {flags: 'a'})
const app = express()
app.use(helmet())
app.use(compression())
app.use(morgan('common', {stream: logStream}))
app.use(express.static(path.join(__dirname, 'public')))
app.get('/', function (req, res) {
  res.sendfile(path.join(__dirname, 'public/index.html'))
})

//
// http server
//
const server = http.createServer(app)

server.on('error', function (err) {
  console.log('server error:', err)
})

server.listen(cmd.port, function () {
  printUrlList()
  startSSH()
})

//
// wss
//
const wss = new WSserver({server: server})
wss.broadcast = function broadcast (data) {
  process.nextTick(function () {
    wss.clients.forEach(function (socket) {
      socket.send(data)
    })
  })
}

wss.on('connection', function (ws) {
  ws.send('\r\n\x1b[33m Welcome to the show!\x1b[0m\r\n\r\n')

  process.stdout.write('\x1b]0; new connection\x07')

  ws.on('close', function () {
    ws.terminate()
  })

  ws.on('error', function (err) {
    log('error:', err.stack)
  })
})

wss.on('error', function (err) {
  log('wss error:', err.stack)
})

//
// ssh
//
function startSSH () {
  ssh(cmd.args)
    .on('data', wss.broadcast)
    .on('end', function () {
      process.exit(0)
    })
    .on('error', function (err) {
      console.error(err)
      process.exit(1)
    })
    .on('info', function (info) {
      console.log(info + '\n')
    })
}

//
//
//
function printUrlList () {
  const netcfg = os.networkInterfaces()
  const ifnames = Object.keys(netcfg).map((o) => netcfg[o])
  const urls = [].concat.apply([], ifnames)
   .filter((o) => o.internal === false)
   .filter((o) => !/^fe80/.test(o.address))
   .map((o) => o.address)
   .map((ip) => util.format(' http://%s:%s', ip, cmd.port))
   .join('\n')
  console.log('server listening on:\n%s\n', urls)
}

function log () {
  console.log('%s - %s', new Date().toISOString(),
    util.format.apply(util.format, arguments))
}

